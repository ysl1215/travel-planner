import { NextRequest, NextResponse } from "next/server";
import { stream } from "@/lib/ai";
import { buildChatSystemPrompt } from "@/lib/prompts";
import { TripPlannerInput } from "@/lib/types";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(ip, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
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

    const windowedMessages = messages.slice(-10);
    const responseStream = await stream([
      { role: "system", content: systemPrompt },
      ...windowedMessages,
    ]);

    return new NextResponse(responseStream, {
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
