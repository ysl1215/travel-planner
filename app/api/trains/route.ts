import { NextRequest, NextResponse } from "next/server";
import { searchTrains, toTrainEstimate } from "@/lib/hafas";
import { getTrainEstimate } from "@/lib/trainFares";
import { createTtlCache } from "@/lib/ttlCache";

// In-memory cache (TTL: 1 hour — train prices change slowly, bounded)
const cache = createTtlCache<any>({ ttlMs: 60 * 60 * 1000, max: 200 });

/**
 * GET /api/trains?origin=Paris&destination=Amsterdam&date=2026-06-01
 *
 * Returns train fare and duration between two European cities.
 * Primary: hafas-client (live DB/ÖBB/SBB/SNCF data)
 * Fallback: static fare estimates
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = searchParams.get("origin") ?? "";
  const destination = searchParams.get("destination") ?? "";
  const date = searchParams.get("date") ?? "";

  if (!origin || !destination) {
    return NextResponse.json(
      { error: "Missing required params: origin, destination" },
      { status: 400 }
    );
  }

  const cacheKey = `${origin.toLowerCase()}-${destination.toLowerCase()}-${date}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  // Try live search first
  const live = await searchTrains(origin, destination, date || undefined);

  if (live) {
    const estimate = toTrainEstimate(live);
    const responseData = {
      ...estimate,
      duration: live.duration,
      operator: live.operator,
      source: "live" as const,
    };
    cache.set(cacheKey, responseData);
    return NextResponse.json(responseData);
  }

  // Fallback to static estimates
  const staticEstimate = getTrainEstimate(origin, destination);
  if (staticEstimate) {
    const responseData = { ...staticEstimate, duration: null, operator: null, source: "static" as const };
    cache.set(cacheKey, responseData);
    return NextResponse.json(responseData);
  }

  return NextResponse.json(
    { error: "No train route found between these cities" },
    { status: 404 }
  );
}
