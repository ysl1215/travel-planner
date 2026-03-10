import { NextRequest, NextResponse } from "next/server";
import { generateWithGroq } from "@/lib/groq";
import { buildDestinationPrompt } from "@/lib/prompts";
import { TripPlannerInput, Destination } from "@/lib/types";

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
    const raw = await generateWithGroq(
      "You are an expert travel planner. Always respond with valid JSON only.",
      prompt
    );

    // Extract JSON from the response
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Could not parse destination suggestions from AI response");
    }

    const destinations: Destination[] = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ destinations });
  } catch (error) {
    console.error("Error generating destinations:", error);
    const message = error instanceof Error ? error.message : "Failed to generate destinations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
