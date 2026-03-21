import { NextRequest, NextResponse } from "next/server";
import Ajv from "ajv";
import destinationsSchema from "@/lib/schemas/destinations.schema.json";
import { generateWithOpenRouter } from "@/lib/openrouter";
import { buildDestinationPrompt } from "@/lib/prompts";
import { TripPlannerInput, Destination } from "@/lib/types";

const ajv = new Ajv();
const validateDestinations = ajv.compile(destinationsSchema as any);

export async function POST(request: NextRequest) {
  try {
    const input: TripPlannerInput = await request.json();

    if (!input.budget || !input.homeCity || !input.travelers) {
      return NextResponse.json(
        { error: "Missing required fields: budget, homeCity, travelers" },
        { status: 400 }
      );
    }

    const prompt = buildDestinationPrompt(input);
    const raw = await generateWithOpenRouter(
      "You are an expert travel planner. Always respond with valid JSON only.",
      prompt
    );

    // Robust JSON extraction and parsing for arrays
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
      return s.replace(/,\s*(?=[}\]])/g, "");
    }

    let candidate = extractJsonByFirstBracket(raw, "[") ?? (raw.match(/\[[\s\S]*\]/)?.[0] ?? null);
    if (!candidate) {
      throw new Error("Could not parse destination suggestions from AI response");
    }

    try {
      const destinations: Destination[] = JSON.parse(candidate);
      const valid = validateDestinations(destinations as any);
      if (!valid) {
        console.error('Destination validation errors:', validateDestinations.errors);
        throw new Error(`Destinations JSON failed schema validation: ${JSON.stringify(validateDestinations.errors)}`);
      }
      return NextResponse.json({ destinations });
    } catch (err) {
      const sanitized = sanitizeJsonTrailingCommas(candidate);
      try {
        const destinations: Destination[] = JSON.parse(sanitized);
        const valid = validateDestinations(destinations as any);
        if (!valid) {
          console.error('Destination validation errors:', validateDestinations.errors);
          throw new Error(`Destinations JSON failed schema validation: ${JSON.stringify(validateDestinations.errors)}`);
        }
        return NextResponse.json({ destinations });
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
            const destinations: Destination[] = JSON.parse(repaired);
            const valid = validateDestinations(destinations as any);
            if (!valid) {
              console.error('Destination validation errors:', validateDestinations.errors);
              throw new Error(`Destinations JSON failed schema validation: ${JSON.stringify(validateDestinations.errors)}`);
            }
            return NextResponse.json({ destinations });
          } catch (err3) {
            throw new Error(`Failed to parse destination JSON after repair: ${err3 instanceof Error ? err3.message : String(err3)}. Raw snippet: ${candidate.slice(0, 1000)}`);
          }
        }

        throw new Error(
          `Failed to parse destination JSON: ${err2 instanceof Error ? err2.message : String(err2)}. Raw snippet: ${candidate.slice(0, 1000)}`
        );
      }
    }
  } catch (error) {
    console.error("Error generating destinations:", error);
    const message = error instanceof Error ? error.message : "Failed to generate destinations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
