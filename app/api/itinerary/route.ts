import { NextRequest, NextResponse } from "next/server";
import { generateWithGroq } from "@/lib/groq";
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
    const raw = await generateWithGroq(
      "You are an expert travel planner with deep local knowledge. Always respond with valid JSON only.",
      prompt,
      "llama-3.3-70b-versatile"
    );

    // Extract JSON from the response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse itinerary from AI response");
    }

    const itinerary: TripItinerary = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ itinerary });
  } catch (error) {
    console.error("Error generating itinerary:", error);
    const message = error instanceof Error ? error.message : "Failed to generate itinerary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
