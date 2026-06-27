import { NextRequest, NextResponse } from "next/server";
import { cityToAirport } from "@/lib/airports";
import { generate } from "@/lib/ai";

// Airport codes are static, so the AI-resolved fallback is cached permanently (per
// process) keyed by lowercased city. This is the only external-call route that was
// uncached, and it re-fires on every tripInput change from the client (page.tsx).
const airportCodeCache = new Map<string, string | null>();

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city")?.trim();
  if (!city) return NextResponse.json({ error: "city required" }, { status: 400 });

  // Try static lookup first
  const code = cityToAirport(city);
  if (code) return NextResponse.json({ code });

  // Cached AI-fallback result (hit or confirmed miss)
  const cacheKey = city.toLowerCase();
  if (airportCodeCache.has(cacheKey)) {
    return NextResponse.json({ code: airportCodeCache.get(cacheKey) });
  }

  // AI fallback
  try {
    const result = await generate(
      "You are an aviation expert. Reply with ONLY the 3-letter IATA airport code for the main international airport of the given city. If unknown, reply with UNKNOWN.",
      city,
      undefined,
      { preferShortFirst: true, taskType: "airport_code" }
    );
    const match = result.trim().toUpperCase().match(/^[A-Z]{3}$/);
    const resolved = match ? match[0] : null;
    airportCodeCache.set(cacheKey, resolved);
    return NextResponse.json({ code: resolved });
  } catch {
    // Transient error — do NOT cache, so a retry can still resolve it.
    return NextResponse.json({ code: null });
  }
}
