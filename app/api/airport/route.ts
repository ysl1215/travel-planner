import { NextRequest, NextResponse } from "next/server";
import { cityToAirport } from "@/lib/airports";
import { generate } from "@/lib/ai";

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city")?.trim();
  if (!city) return NextResponse.json({ error: "city required" }, { status: 400 });

  // Try static lookup first
  const code = cityToAirport(city);
  if (code) return NextResponse.json({ code });

  // AI fallback
  try {
    const result = await generate(
      "You are an aviation expert. Reply with ONLY the 3-letter IATA airport code for the main international airport of the given city. If unknown, reply with UNKNOWN.",
      city,
      undefined,
      { preferShortFirst: true }
    );
    const match = result.trim().toUpperCase().match(/^[A-Z]{3}$/);
    if (match) return NextResponse.json({ code: match[0] });
    return NextResponse.json({ code: null });
  } catch {
    return NextResponse.json({ code: null });
  }
}
