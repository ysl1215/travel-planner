import { NextRequest, NextResponse } from "next/server";
import { streamWithGroq } from "@/lib/groq";
import { buildChatSystemPrompt } from "@/lib/prompts";
import { TripPlannerInput } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const {
      messages,
      tripContext,
      destination,
    }: {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      tripContext?: TripPlannerInput | null;
      destination?: string;
    } = await request.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    const systemPrompt = buildChatSystemPrompt(tripContext ?? null, destination);

    const stream = await streamWithGroq([
      { role: "system", content: systemPrompt },
      ...messages,
    ]);

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Error in chat:", error);
    const message = error instanceof Error ? error.message : "Chat request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
