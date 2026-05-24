import { NextRequest, NextResponse } from "next/server";
import { searchHotels, toAccomEstimate, cityToIataCode, isConfigured } from "@/lib/amadeus";
import { getAccomEstimate } from "@/lib/accomEstimates";

// In-memory cache (TTL: 30 minutes)
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { data: any; timestamp: number }>();

/**
 * GET /api/hotels?city=Paris&checkIn=2026-06-01&checkOut=2026-06-08&adults=2
 *
 * Returns nightly hotel price tiers for a city.
 * Primary: Amadeus Hotel Search API (if AMADEUS_CLIENT_ID/SECRET are set)
 * Fallback: static accommodation estimates
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") ?? "";
  const checkIn = searchParams.get("checkIn") ?? "";
  const checkOut = searchParams.get("checkOut") ?? "";
  const adults = parseInt(searchParams.get("adults") ?? "1", 10);

  if (!city) {
    return NextResponse.json({ error: "Missing required param: city" }, { status: 400 });
  }

  const cacheKey = `${city.toLowerCase()}-${checkIn}-${checkOut}-${adults}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  // Try Amadeus live search
  if (isConfigured() && checkIn && checkOut) {
    const cityCode = cityToIataCode(city);
    if (cityCode) {
      const live = await searchHotels(cityCode, checkIn, checkOut, adults);
      if (live) {
        const estimate = toAccomEstimate(live, city);
        const responseData = {
          ...estimate,
          sampleCount: live.sampleCount,
          source: "live" as const,
        };
        cache.set(cacheKey, { data: responseData, timestamp: Date.now() });
        return NextResponse.json(responseData);
      }
    }
  }

  // Fallback to static estimates
  const staticEstimate = getAccomEstimate(city);
  if (staticEstimate) {
    const responseData = { ...staticEstimate, sampleCount: 0, source: "static" as const };
    cache.set(cacheKey, { data: responseData, timestamp: Date.now() });
    return NextResponse.json(responseData);
  }

  return NextResponse.json(
    { error: "No accommodation data available for this city" },
    { status: 404 }
  );
}
