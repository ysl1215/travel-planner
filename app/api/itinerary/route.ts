import { NextRequest, NextResponse } from "next/server";
import Ajv from "ajv";
import itinerarySchema from "@/lib/schemas/itinerary.schema.json";
import { generateWithOpenRouter } from "@/lib/openrouter";
import { requestJsonCorrection } from "@/lib/aiFix";
import { buildItineraryPrompt } from "@/lib/prompts";
import { TripPlannerInput, TripItinerary } from "@/lib/types";

const ajv = new Ajv();
const validateItinerary = ajv.compile(itinerarySchema as any);

export async function POST(request: NextRequest) {
  try {
    const {
      destination,
      input,
      budgetSplit,
      expand = false,
      preferModel,
    }: {
      destination: string;
      input: TripPlannerInput;
      budgetSplit: {
        travel: number;
        accommodation: number;
        food: number;
        activities: number;
        misc: number;
      };
      expand?: boolean;
      preferModel?: string;
    } = await request.json();

    if (!destination || !input) {
      return NextResponse.json(
        { error: "Missing required fields: destination, input" },
        { status: 400 }
      );
    }

    const prompt = buildItineraryPrompt(destination, input, budgetSplit);
    // Short-first behavior by default; caller may set expand=true to request a full, higher-token reply
    const opts = expand ? undefined : { preferShortFirst: true } as any;
    const raw = await generateWithOpenRouter(
      "You are an expert travel planner with deep local knowledge. Always respond with valid JSON only.",
      prompt,
      preferModel,
      opts
    );

    // Robust JSON extraction and parsing
    function extractJsonByFirstBracket(text: string, startChar: "{" | "["): string | null {
      const opening = startChar;
      const closing = startChar === "{" ? "}" : "]";
      const startIndex = text.indexOf(opening);
      if (startIndex === -1) return null;
      let depth = 0;
      let inString = false;
      for (let i = startIndex; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"' && text[i - 1] !== "\\") inString = !inString;
        if (inString) continue;
        if (ch === opening) depth++;
        else if (ch === closing) {
          depth--;
          if (depth === 0) return text.slice(startIndex, i + 1);
        }
      }
      return null;
    }

    function sanitizeJsonTrailingCommas(s: string): string {
      // Remove trailing commas before } or ]
      return s.replace(/,\s*(?=[}\]])/g, "");
    }

    let candidate = extractJsonByFirstBracket(raw, "{") ?? (raw.match(/\{[\s\S]*\}/)?.[0] ?? null);
    if (!candidate) {
      throw new Error("Could not parse itinerary from AI response");
    }

    try {
      const itinerary: TripItinerary = JSON.parse(candidate);
      const valid = validateItinerary(itinerary as any);
      if (!valid) {
        console.error('Itinerary validation errors:', validateItinerary.errors);
        throw new Error(`Itinerary JSON failed schema validation: ${JSON.stringify(validateItinerary.errors)}`);
      }
      return NextResponse.json({ itinerary });
    } catch (err) {
      const sanitized = sanitizeJsonTrailingCommas(candidate);
      try {
        const itinerary: TripItinerary = JSON.parse(sanitized);
        const valid = validateItinerary(itinerary as any);
        if (!valid) {
          console.error('Itinerary validation errors:', validateItinerary.errors);
          throw new Error(`Itinerary JSON failed schema validation: ${JSON.stringify(validateItinerary.errors)}`);
        }
        return NextResponse.json({ itinerary });
      } catch (err2) {
        // Attempt to auto-close any unbalanced open brackets/braces (best-effort repair for truncated responses)
        function computeMissingClosers(s: string): string {
          const stack: string[] = [];
          let inString = false;
          for (let i = 0; i < s.length; i++) {
            const ch = s[i];
            if (ch === '"' && s[i - 1] !== "\\") inString = !inString;
            if (inString) continue;
            if (ch === '{' || ch === '[') stack.push(ch);
            else if (ch === '}' || ch === ']') {
              const top = stack[stack.length - 1];
              if ((ch === '}' && top === '{') || (ch === ']' && top === '[')) stack.pop();
            }
          }
          let closers = '';
          while (stack.length) {
            const opener = stack.pop();
            if (opener === '{') closers += '}';
            else if (opener === '[') closers += ']';
          }
          return closers;
        }

        const closers = computeMissingClosers(sanitized);
        if (closers) {
          const repaired = sanitized + closers;
          try {
            const itinerary: TripItinerary = JSON.parse(repaired);
            const valid = validateItinerary(itinerary as any);
            if (valid) {
              return NextResponse.json({ itinerary });
            }
            // fall through to re-prompt step
          } catch (err3) {
            // fall through to re-prompt step
          }
        }

        // Attempt to ask the model to fix the JSON (re-prompt) once
        try {
          const fixPrompt = `The JSON below failed validation for an itinerary. Validation errors: ${JSON.stringify(validateItinerary.errors || [])}\n\nOriginal JSON: ${sanitized}\n\nPlease return a corrected JSON object only that conforms to the itinerary schema. Output ONLY the JSON object.`;
          const fixedRaw = await requestJsonCorrection(sanitized, validateItinerary.errors || [], 'itinerary', fixPrompt);
          const fixedCandidate = extractJsonByFirstBracket(fixedRaw, '{') ?? (fixedRaw.match(/\{[\s\S]*\}/)?.[0] ?? null);
          if (!fixedCandidate) throw new Error('Model did not return JSON');
          const sanitized2 = sanitizeJsonTrailingCommas(fixedCandidate);
          const closers2 = computeMissingClosers(sanitized2);
          const repaired2 = closers2 ? sanitized2 + closers2 : sanitized2;
          const itinerary: TripItinerary = JSON.parse(repaired2);
          const valid2 = validateItinerary(itinerary as any);
          if (!valid2) {
            console.error('Itinerary validation errors after re-prompt:', validateItinerary.errors);
            throw new Error(`Itinerary JSON failed schema validation after re-prompt: ${JSON.stringify(validateItinerary.errors)}`);
          }
          return NextResponse.json({ itinerary });
        } catch (finalErr) {
          throw new Error(`Failed to parse itinerary JSON after repair and re-prompt: ${finalErr instanceof Error ? finalErr.message : String(finalErr)}. Raw snippet: ${candidate.slice(0, 1000)}`);
        }
      }
    }
  } catch (error) {
    console.error("Error generating itinerary:", error);
    const message = error instanceof Error ? error.message : "Failed to generate itinerary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
