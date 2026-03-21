import { NextRequest, NextResponse } from "next/server";
import { generateWithOpenRouter } from "@/lib/openrouter";
import { buildItineraryPrompt } from "@/lib/prompts";
import { TripPlannerInput, TripItinerary } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const {
      destination,
      input,
      budgetSplit,
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
    } = await request.json();

    if (!destination || !input) {
      return NextResponse.json(
        { error: "Missing required fields: destination, input" },
        { status: 400 }
      );
    }

    const prompt = buildItineraryPrompt(destination, input, budgetSplit);
    const raw = await generateWithOpenRouter(
      "You are an expert travel planner with deep local knowledge. Always respond with valid JSON only.",
      prompt
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
      return NextResponse.json({ itinerary });
    } catch (err) {
      const sanitized = sanitizeJsonTrailingCommas(candidate);
      try {
        const itinerary: TripItinerary = JSON.parse(sanitized);
        return NextResponse.json({ itinerary });
      } catch (err2) {
        throw new Error(
          `Failed to parse itinerary JSON: ${err2 instanceof Error ? err2.message : String(err2)}. Raw snippet: ${candidate.slice(0, 1000)}`
        );
      }
    }
  } catch (error) {
    console.error("Error generating itinerary:", error);
    const message = error instanceof Error ? error.message : "Failed to generate itinerary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
