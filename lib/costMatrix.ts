/**
 * Cost matrix builder for multi-city route ordering.
 *
 * Produces the asymmetric CostMatrix consumed by lib/routeOrder.ts from real travel
 * estimates. The always-available seed is great-circle flight hours
 * (`estimateFlightHoursAsync`, lib/flightTime.ts); legs the caller marks unavailable
 * (e.g. an infrequent ferry, or "no route on this date") become Infinity so the
 * optimizer routes around them — the v1 "penalty" approach to the infrequent-transport
 * problem. Time-windowed schedules ("ferry only Tuesdays") are out of scope (TSP-TW).
 *
 * The matrix type is asymmetric by design even though the flight-hours seed is symmetric,
 * so a later pass can overwrite individual legs with directional price/time from Kiwi /
 * Duffel / hafas without changing this contract.
 */

import { estimateFlightHoursAsync, warmGeocodeCache } from "@/lib/flightTime";

/** A directed leg that should be treated as unavailable (Infinity cost). */
export interface UnavailableLeg {
  from: string;
  to: string;
}

export interface BuildCostMatrixOptions {
  /**
   * Cost (in the same unit as the seed — hours) used when an estimate can't be resolved
   * for a leg (e.g. neither city geocodes). NOT Infinity: an unknown leg shouldn't make
   * the whole route unsolvable. Defaults to 24 (a deliberately high "we don't know, avoid
   * if possible" value, still finite).
   */
  unknownLegCost?: number;
  /** Directed legs to mark unavailable (Infinity). Matched case-insensitively. */
  unavailable?: UnavailableLeg[];
}

export interface CostMatrixResult {
  /** Cities in matrix order (same array passed in). */
  cities: string[];
  /** Asymmetric cost matrix; cost[i][j] = estimated hours from cities[i] to cities[j]. */
  cost: number[][];
  /** Legs that fell back to unknownLegCost (couldn't be estimated), for transparency. */
  unresolved: { from: string; to: string }[];
}

function normalize(city: string): string {
  return city.toLowerCase().trim();
}

/**
 * Build an asymmetric cost matrix (estimated travel hours) for a set of cities.
 * Seed is great-circle flight hours; unavailable legs are Infinity; unresolved legs
 * fall back to a finite `unknownLegCost`.
 *
 * Network: uses `estimateFlightHoursAsync`, which only hits Nominatim for cities not in
 * the static coordinate table (and caches results), so repeated/known cities are cheap.
 */
export async function buildCostMatrix(
  cities: string[],
  opts: BuildCostMatrixOptions = {}
): Promise<CostMatrixResult> {
  const n = cities.length;
  const unknownLegCost = opts.unknownLegCost ?? 24;

  const blocked = new Set(
    (opts.unavailable ?? []).map((l) => `${normalize(l.from)}→${normalize(l.to)}`)
  );

  const cost: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const unresolved: { from: string; to: string }[] = [];

  // Geocode every unique city ONCE up front (network calls serialized ~1.1s apart inside
  // the cache). This turns the old O(n²) serial-geocode cliff — which paid a 1.1s stagger
  // per city PAIR, even on cache hits — into at most n network calls. After this, every
  // estimateFlightHoursAsync call below is a pure cache hit.
  await warmGeocodeCache(cities);

  // The great-circle seed is symmetric, so estimate each unordered pair once and fill
  // both directions; directional overrides (price/time) can replace either cell later.
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const hours = await estimateFlightHoursAsync(cities[i], cities[j]);
      const value = hours ?? unknownLegCost;
      if (hours == null) {
        unresolved.push({ from: cities[i], to: cities[j] });
      }
      cost[i][j] = value;
      cost[j][i] = value;
    }
  }

  // Apply unavailable legs last so they override the seed (directional).
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (blocked.has(`${normalize(cities[i])}→${normalize(cities[j])}`)) {
        cost[i][j] = Infinity;
      }
    }
  }

  return { cities, cost, unresolved };
}
