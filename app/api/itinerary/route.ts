import { NextRequest, NextResponse } from "next/server";
import Ajv from "ajv";
import itinerarySchema from "@/lib/schemas/itinerary.schema.json";
import { generate } from "@/lib/ai";
import { requestJsonCorrection } from "@/lib/aiFix";
import { buildItineraryPrompt } from "@/lib/prompts";
import { TripPlannerInput, TripItinerary } from "@/lib/types";
import { rateLimit } from "@/lib/rateLimit";
import { getAttractions } from "@/lib/db";
import { buildAttractionContext } from "@/lib/attractionContext";

const ajv = new Ajv();
const validateItinerary = ajv.compile(itinerarySchema as any);

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(ip, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
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

    // Load indexed attraction data for this city (empty array if not yet scraped)
    const cityName = destination.split(",")[0].trim();
    const indexedAttractions = getAttractions(cityName);
    const attractionContext = indexedAttractions.length > 0
      ? buildAttractionContext(indexedAttractions, {
          likedActivities: input.likedActivities,
          travelStyle: input.travelStyle,
          preferHiddenGems: input.preferHiddenGems,
        })
      : undefined;

    if (attractionContext) {
      console.log(`[itinerary] Injecting ${indexedAttractions.length} indexed attractions for ${cityName}`);
    }

    const prompt = buildItineraryPrompt(destination, input, budgetSplit, attractionContext);
    const raw = await generate(
      "You are an expert travel planner with deep local knowledge. Always respond with valid JSON only.",
      prompt,
      preferModel
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
      // If no JSON found, attempt a model-assisted extraction (best-effort): ask the model to return ONLY the intended JSON
      try {
        const fixedRaw = await requestJsonCorrection(raw, [], 'itinerary', 'The previous response did not contain JSON. Please return the corrected JSON object only that matches the itinerary schema.');
        candidate = extractJsonByFirstBracket(fixedRaw, "{") ?? (fixedRaw.match(/\{[\s\S]*\}/)?.[0] ?? null);
      } catch (e) {
        // Fall through to final error
      }
      if (!candidate) {
        throw new Error("Could not parse itinerary from AI response");
      }
    }

    try {
      const itinerary: TripItinerary = JSON.parse(candidate);
      const valid = validateItinerary(itinerary as any);
      if (!valid) {
        console.error('Itinerary validation errors:', validateItinerary.errors);
        throw new Error(`Itinerary JSON failed schema validation: ${JSON.stringify(validateItinerary.errors)}`);
      }
      return NextResponse.json({ itinerary, indexed: indexedAttractions.length > 0, attractionCount: indexedAttractions.length });
    } catch (err) {
      const sanitized = sanitizeJsonTrailingCommas(candidate);
      try {
        const itinerary: TripItinerary = JSON.parse(sanitized);
        const valid = validateItinerary(itinerary as any);
        if (!valid) {
          console.error('Itinerary validation errors:', validateItinerary.errors);
          throw new Error(`Itinerary JSON failed schema validation: ${JSON.stringify(validateItinerary.errors)}`);
        }
        return NextResponse.json({ itinerary, indexed: indexedAttractions.length > 0, attractionCount: indexedAttractions.length });
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
              return NextResponse.json({ itinerary, indexed: indexedAttractions.length > 0, attractionCount: indexedAttractions.length });
            }
            // fall through to re-prompt step
          } catch (err3) {
            // fall through to re-prompt step
          }
        }

        // Attempt to ask the model to fix the JSON (re-prompt) once
        try {
          const fixedRaw = await requestJsonCorrection(sanitized, validateItinerary.errors || [], 'itinerary');
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
          return NextResponse.json({ itinerary, indexed: indexedAttractions.length > 0, attractionCount: indexedAttractions.length });
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
