/**
 * Route ordering — order a known set of cities into a near-optimal visiting sequence.
 *
 * This is the classic open-path Travelling Salesman Problem at trip scale (a handful of
 * cities, not thousands). TREK (a mature trip planner) validated that a hand-rolled
 * nearest-neighbor + 2-opt heuristic is the right tool here; at n ≤ 10 we can do better
 * and solve it exactly with Held-Karp dynamic programming in milliseconds.
 *
 * The cost matrix is ASYMMETRIC (cost[i][j] may differ from cost[j][i]) and may contain
 * `Infinity` to mark an unavailable/infrequent leg — the optimizer routes around those.
 * Building the matrix from real travel time/price lives in lib/costMatrix.ts; this file
 * is pure graph math with no I/O, so it is fully unit-testable in isolation.
 *
 * NOTE: this finds an open path (visit every city once, no return to start), which matches
 * a multi-city trip. It does not model time windows / schedules ("ferry only Tuesdays") —
 * that is TSP-TW, a separate effort. Infrequent legs are handled via the Infinity penalty.
 */

/** Asymmetric cost matrix. cost[i][j] = cost to go from city i to city j. Infinity = no/blocked leg. */
export type CostMatrix = number[][];

export interface OrderRouteOptions {
  /** Index of the city that must be first (e.g. the home/arrival city). */
  fixedStart?: number;
  /** Index of the city that must be last (e.g. a fixed departure city). */
  fixedEnd?: number;
}

export interface OrderRouteResult {
  /** Visiting order as city indices into the input array. */
  order: number[];
  /** Total path cost (sum of consecutive legs). Infinity if no valid path exists. */
  totalCost: number;
}

const HELD_KARP_MAX = 10; // exact DP up to this many cities; heuristic above.

/**
 * Order cities into a near-optimal open path minimising total leg cost.
 *
 * @param cities  city labels (only `.length` and indices are used here).
 * @param cost    asymmetric cost matrix; Infinity marks unavailable legs.
 * @param opts    optional fixedStart / fixedEnd anchors.
 */
export function orderRoute(
  cities: string[],
  cost: CostMatrix,
  opts: OrderRouteOptions = {}
): OrderRouteResult {
  const n = cities.length;
  if (n === 0) return { order: [], totalCost: 0 };
  if (n === 1) return { order: [0], totalCost: 0 };

  validateMatrix(cost, n);

  const exact = n <= HELD_KARP_MAX;
  const base = exact ? heldKarp(cost, n, opts) : nearestNeighborThen2opt(cost, n, opts);
  return base;
}

/** Total cost of a given order; Infinity if any leg is unavailable. */
export function pathCost(order: number[], cost: CostMatrix): number {
  let total = 0;
  for (let i = 0; i < order.length - 1; i++) {
    total += cost[order[i]][order[i + 1]];
  }
  return total;
}

function validateMatrix(cost: CostMatrix, n: number): void {
  if (cost.length !== n) {
    throw new Error(`Cost matrix has ${cost.length} rows but ${n} cities were given.`);
  }
  for (let i = 0; i < n; i++) {
    if (cost[i].length !== n) {
      throw new Error(`Cost matrix row ${i} has ${cost[i].length} columns but ${n} were expected.`);
    }
  }
}

// ── Exact: Held-Karp DP for the open-path TSP ─────────────────────────────────
//
// dp[mask][j] = min cost of a path that starts at the start node, visits exactly the
// set `mask`, and ends at city j. We reconstruct the order via a parent table.

function heldKarp(cost: CostMatrix, n: number, opts: OrderRouteOptions): OrderRouteResult {
  const end = opts.fixedEnd;

  const FULL = (1 << n) - 1;
  const dp: number[][] = Array.from({ length: 1 << n }, () => new Array(n).fill(Infinity));
  const parent: number[][] = Array.from({ length: 1 << n }, () => new Array(n).fill(-1));

  // Seed the start node(s): a single fixed start, or every city when the start is free
  // (so we find the globally optimal open path, not one constrained to begin at city 0).
  const starts = opts.fixedStart != null ? [opts.fixedStart] : Array.from({ length: n }, (_, i) => i);
  for (const s of starts) dp[1 << s][s] = 0;

  for (let mask = 0; mask <= FULL; mask++) {
    for (let j = 0; j < n; j++) {
      if (!(mask & (1 << j))) continue;
      const cur = dp[mask][j];
      if (cur === Infinity) continue;
      for (let k = 0; k < n; k++) {
        if (mask & (1 << k)) continue;       // k already visited
        const leg = cost[j][k];
        if (leg === Infinity) continue;       // unavailable leg
        const nextMask = mask | (1 << k);
        const cand = cur + leg;
        if (cand < dp[nextMask][k]) {
          dp[nextMask][k] = cand;
          parent[nextMask][k] = j;
        }
      }
    }
  }

  // Choose the best end city (respecting fixedEnd if set).
  let bestEnd = -1;
  let bestCost = Infinity;
  const candidateEnds = end != null ? [end] : Array.from({ length: n }, (_, i) => i);
  for (const j of candidateEnds) {
    if (dp[FULL][j] < bestCost) {
      bestCost = dp[FULL][j];
      bestEnd = j;
    }
  }

  if (bestEnd === -1 || bestCost === Infinity) {
    // No valid Hamiltonian path under the constraints (e.g. Infinity legs disconnect it).
    return { order: [], totalCost: Infinity };
  }

  // Reconstruct order by walking parents back from (FULL, bestEnd).
  const order: number[] = [];
  let mask = FULL;
  let j = bestEnd;
  while (j !== -1) {
    order.push(j);
    const p = parent[mask][j];
    mask ^= 1 << j;
    j = p;
  }
  order.reverse();
  return { order, totalCost: bestCost };
}

// ── Heuristic: nearest-neighbor seed + 2-opt for larger n ─────────────────────

function nearestNeighborThen2opt(cost: CostMatrix, n: number, opts: OrderRouteOptions): OrderRouteResult {
  const start = opts.fixedStart ?? 0;
  let order = nearestNeighbor(cost, n, start);
  if (opts.fixedEnd != null) order = moveToEnd(order, opts.fixedEnd);
  order = twoOpt(order, cost, opts);
  return { order, totalCost: pathCost(order, cost) };
}

function nearestNeighbor(cost: CostMatrix, n: number, start: number): number[] {
  const visited = new Array(n).fill(false);
  const order = [start];
  visited[start] = true;
  let current = start;
  for (let step = 1; step < n; step++) {
    let best = -1;
    let bestCost = Infinity;
    for (let k = 0; k < n; k++) {
      if (visited[k]) continue;
      if (cost[current][k] < bestCost) {
        bestCost = cost[current][k];
        best = k;
      }
    }
    if (best === -1) {
      // Disconnected from here — append remaining cities in index order (best effort).
      for (let k = 0; k < n; k++) if (!visited[k]) { order.push(k); visited[k] = true; }
      break;
    }
    order.push(best);
    visited[best] = true;
    current = best;
  }
  return order;
}

/**
 * 2-opt local search for an OPEN path. Repeatedly reverses a sub-segment when doing so
 * lowers total cost. Respects fixed start (index 0 of the order) and fixed end positions
 * by never moving those endpoints.
 */
function twoOpt(initial: number[], cost: CostMatrix, opts: OrderRouteOptions): number[] {
  const n = initial.length;
  if (n < 4) return initial; // nothing to improve on a path this short

  let order = initial.slice();
  // 2-opt reverses an interior segment, so position 0 (the start) is always preserved.
  // When the end is fixed, also keep the last position out of the reversal window.
  const lo = 1;
  const hiExclusive = opts.fixedEnd != null ? n - 1 : n;

  let improved = true;
  let guard = 0;
  const maxPasses = 1000; // safety bound; converges well before this at trip scale
  while (improved && guard++ < maxPasses) {
    improved = false;
    for (let i = lo; i < hiExclusive - 1; i++) {
      for (let k = i + 1; k < hiExclusive; k++) {
        const delta = twoOptDelta(order, cost, i, k);
        if (delta < -1e-9) {
          reverseSegment(order, i, k);
          improved = true;
        }
      }
    }
  }
  return order;
}

/** Cost change from reversing order[i..k] (inclusive) for an open path. */
function twoOptDelta(order: number[], cost: CostMatrix, i: number, k: number): number {
  const a = order[i - 1];
  const b = order[i];
  const c = order[k];
  const d = order[k + 1]; // may be undefined if k is the last index

  // Edges removed: (a→b) and (c→d). Edges added: (a→c) and (b→d).
  // The reversed interior keeps the same set of internal edges only for a SYMMETRIC
  // matrix; for asymmetric costs we recompute the interior direction too.
  const before = cost[a][b] + interiorCost(order, cost, i, k) + (d !== undefined ? cost[c][d] : 0);
  const after = cost[a][c] + interiorCostReversed(order, cost, i, k) + (d !== undefined ? cost[b][d] : 0);
  return after - before;
}

function interiorCost(order: number[], cost: CostMatrix, i: number, k: number): number {
  let s = 0;
  for (let x = i; x < k; x++) s += cost[order[x]][order[x + 1]];
  return s;
}

function interiorCostReversed(order: number[], cost: CostMatrix, i: number, k: number): number {
  let s = 0;
  for (let x = k; x > i; x--) s += cost[order[x]][order[x - 1]];
  return s;
}

function reverseSegment(order: number[], i: number, k: number): void {
  while (i < k) {
    const tmp = order[i];
    order[i] = order[k];
    order[k] = tmp;
    i++;
    k--;
  }
}

function moveToEnd(order: number[], city: number): number[] {
  const filtered = order.filter((c) => c !== city);
  filtered.push(city);
  return filtered;
}
