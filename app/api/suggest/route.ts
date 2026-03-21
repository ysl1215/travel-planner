import { NextRequest, NextResponse } from "next/server";
import Ajv from "ajv";
import destinationsSchema from "@/lib/schemas/destinations.schema.json";
import { generate } from "@/lib/ai";
import { requestJsonCorrection } from "@/lib/aiFix";
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
    const raw = await generate(
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

    // Helper to compute missing closing brackets/braces for truncated responses
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

    function tryParseAndValidate(s: string) {
      try {
        const parsed: Destination[] = JSON.parse(s);
        const valid = validateDestinations(parsed as any);
        return { parsed, valid };
      } catch (e) {
        return { parsed: null, valid: false };
      }
    }

    function sanitizeRepair(s: string) {
      const sanitized = sanitizeJsonTrailingCommas(s);
      const closers = computeMissingClosers(sanitized);
      return closers ? sanitized + closers : sanitized;
    }

    // 1) Try parsing the raw candidate
    let attemptCandidate = candidate;
    let result = tryParseAndValidate(attemptCandidate);
    if (result.parsed && result.valid) {
      return NextResponse.json({ destinations: result.parsed });
    }

    // 2) Try sanitized/repair parse
    attemptCandidate = sanitizeRepair(candidate);
    result = tryParseAndValidate(attemptCandidate);
    if (result.parsed && result.valid) {
      return NextResponse.json({ destinations: result.parsed });
    }

    // 3) Re-prompt loop: ask the model to correct the JSON up to 3 times
    let lastFixedRaw: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const extra = attempt > 0 ? `Attempt ${attempt + 1} of 3. Previous attempts failed validation. Only return the missing or corrected fields.` : undefined;
        lastFixedRaw = await requestJsonCorrection(attemptCandidate, validateDestinations.errors ?? [], "destinations", extra);
      } catch (e) {
        console.error('requestJsonCorrection error:', e);
        continue;
      }

      const extracted = extractJsonByFirstBracket(lastFixedRaw, "[") ?? (lastFixedRaw.match(/\[[\s\S]*\]/)?.[0] ?? null);
      if (!extracted) continue;
      attemptCandidate = sanitizeRepair(extracted);
      result = tryParseAndValidate(attemptCandidate);
      if (result.parsed && result.valid) {
        return NextResponse.json({ destinations: result.parsed });
      }
      // otherwise loop and give the model more context (errors) next iteration
    }

    // 4) Fallback: try to parse the last candidate and auto-fill missing required fields
    const finalCandidate = attemptCandidate;
    try {
      const destinations: Destination[] = JSON.parse(finalCandidate);

      // Helper to generate a stable-ish ID
      function genId(i: number) {
        return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}-${i}`;
      }

      function defaultFlightHours(homeCity?: string, destCity?: string) {
        if (!homeCity || !destCity) return 4;
        if (homeCity.toLowerCase() === destCity.toLowerCase()) return 0;
        // crude default — choose 4h as a safe mid-range default
        return 4;
      }

      // Auto-fill missing required fields with sensible defaults or derived values
      for (let i = 0; i < destinations.length; i++) {
        const d: any = destinations[i] as any;

        // Ensure id
        if (!d.id || String(d.id).trim() === "") d.id = genId(i);

        // Ensure country/city exist as strings (schema requires them)
        d.country = d.country ?? "";
        d.city = d.city ?? "";

        // Rationale
        if (!d.rationale || String(d.rationale).trim() === "") {
          d.rationale = `Suggested for ${d.city}${d.country ? ", " + d.country : ""} based on user preferences and budget.`;
        }

        // Highlights
        if (!Array.isArray(d.highlights) || d.highlights.length === 0) {
          d.highlights = d.city || d.country ? [`Top sights in ${d.city}${d.country ? ", " + d.country : ""}`] : ["Top sights"];
        }

        // estimatedFlightHours
        if (d.estimatedFlightHours === undefined || d.estimatedFlightHours === null || Number.isNaN(Number(d.estimatedFlightHours))) {
          d.estimatedFlightHours = defaultFlightHours(input.homeCity, d.city);
        } else {
          d.estimatedFlightHours = Number(d.estimatedFlightHours);
        }

        // estimatedBudgetFit
        const validBudgetFits = ["excellent", "good", "stretch"];
        if (!d.estimatedBudgetFit || !validBudgetFits.includes(String(d.estimatedBudgetFit))) {
          d.estimatedBudgetFit = "good";
        }

        // bestTimeToVisit
        if (!d.bestTimeToVisit || String(d.bestTimeToVisit).trim() === "") {
          d.bestTimeToVisit = "Any time";
        }

        // vibeMatch
        if (!Array.isArray(d.vibeMatch) || d.vibeMatch.length === 0) {
          d.vibeMatch = ["culture"];
        }

        // imageQuery
        if (!d.imageQuery || String(d.imageQuery).trim() === "") {
          const city = d.city ?? "";
          const country = d.country ?? "";
          d.imageQuery = `${city}${country ? ' ' + country : ''}`.trim();
        }
      }

      const valid = validateDestinations(destinations as any);
      if (valid) {
        return NextResponse.json({ destinations });
      } else {
        console.error('Destination validation errors after fallback:', validateDestinations.errors);
        throw new Error(`Destinations JSON failed schema validation after repair/fallback: ${JSON.stringify(validateDestinations.errors)}`);
      }
    } catch (err3) {
      throw new Error(`Failed to parse destination JSON after repair and re-prompts: ${err3 instanceof Error ? err3.message : String(err3)}. Raw snippet: ${candidate.slice(0, 1000)}`);
    }
  } catch (error) {
    console.error("Error generating destinations:", error);
    const message = error instanceof Error ? error.message : "Failed to generate destinations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
