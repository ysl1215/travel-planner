import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { buildCostMatrix, UnavailableLeg } from "@/lib/costMatrix";
import { orderRoute } from "@/lib/routeOrder";
import { RouteSegment } from "@/lib/types";

/**
 * POST /api/route-order
 *
 * Orders a known set of cities into a near-optimal visiting sequence, minimising total
 * estimated travel time and routing around unavailable/infrequent legs. Engine:
 * lib/costMatrix.ts (great-circle hours seed) + lib/routeOrder.ts (open-path TSP).
 *
 * Body:
 *   cities       string[]            — 2+ city names to order
 *   homeCity     string  (optional)  — if present (and in `cities`), anchored as the start
 *   endCity      string  (optional)  — if present (and in `cities`), anchored as the end
 *   unavailable  {from,to}[] (opt.)  — directed legs to treat as unavailable (Infinity)
 *
 * Returns:
 *   order        string[]            — cities in optimal visiting order
 *   segments     RouteSegment[]      — per-leg from/to/duration
 *   totalHours   number              — total estimated travel hours (null if no valid route)
 *   unresolved   {from,to}[]         — legs that couldn't be estimated (used a fallback cost)
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(ip, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const {
      cities,
      homeCity,
      endCity,
      unavailable,
    }: {
      cities: string[];
      homeCity?: string;
      endCity?: string;
      unavailable?: UnavailableLeg[];
    } = await request.json();

    if (!Array.isArray(cities) || cities.length < 2) {
      return NextResponse.json(
        { error: "Provide at least 2 cities to order." },
        { status: 400 }
      );
    }
    // De-dupe (case-insensitive) while preserving first-seen order; the optimizer assumes
    // distinct nodes.
    const seen = new Set<string>();
    const uniqueCities = cities
      .map((c) => String(c).trim())
      .filter((c) => {
        const key = c.toLowerCase();
        if (c === "" || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    if (uniqueCities.length < 2) {
      return NextResponse.json(
        { error: "Need at least 2 distinct, non-empty city names." },
        { status: 400 }
      );
    }

    // Resolve optional anchors to indices.
    const indexOf = (name?: string) =>
      name ? uniqueCities.findIndex((c) => c.toLowerCase() === name.trim().toLowerCase()) : -1;
    const startIdx = indexOf(homeCity);
    const endIdx = indexOf(endCity);

    const { cost, unresolved } = await buildCostMatrix(uniqueCities, { unavailable });

    const result = orderRoute(uniqueCities, cost, {
      fixedStart: startIdx >= 0 ? startIdx : undefined,
      fixedEnd: endIdx >= 0 ? endIdx : undefined,
    });

    if (result.totalCost === Infinity || result.order.length === 0) {
      return NextResponse.json(
        {
          error: "No valid route exists for these cities given the unavailable legs.",
          unresolved,
        },
        { status: 422 }
      );
    }

    const orderedCities = result.order.map((i) => uniqueCities[i]);

    // Build per-leg segments. Cost matrix is in estimated hours.
    const segments: RouteSegment[] = [];
    for (let i = 0; i < result.order.length - 1; i++) {
      const fromIdx = result.order[i];
      const toIdx = result.order[i + 1];
      const hours = cost[fromIdx][toIdx];
      segments.push({
        from: uniqueCities[fromIdx],
        to: uniqueCities[toIdx],
        mode: "estimated", // great-circle estimate; real mode/price is a later enrichment
        duration: formatHours(hours),
        cost: "",
      });
    }

    return NextResponse.json({
      order: orderedCities,
      segments,
      totalHours: Math.round(result.totalCost * 10) / 10,
      unresolved,
    });
  } catch (error) {
    console.error("Error ordering route:", error);
    const message = error instanceof Error ? error.message : "Failed to order route";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** 3.4 → "3h 24m". */
function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}
