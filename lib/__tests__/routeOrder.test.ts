import { describe, it, expect } from "vitest";
import { orderRoute, pathCost, CostMatrix } from "../routeOrder";

// Brute-force optimal open path over all permutations — ground truth for small n.
function bruteForce(cost: CostMatrix, opts: { fixedStart?: number; fixedEnd?: number } = {}) {
  const n = cost.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  let best: number[] = [];
  let bestCost = Infinity;

  const permute = (arr: number[], k: number) => {
    if (k === arr.length) {
      if (opts.fixedStart != null && arr[0] !== opts.fixedStart) return;
      if (opts.fixedEnd != null && arr[arr.length - 1] !== opts.fixedEnd) return;
      const c = pathCost(arr, cost);
      if (c < bestCost) { bestCost = c; best = arr.slice(); }
      return;
    }
    for (let i = k; i < arr.length; i++) {
      [arr[k], arr[i]] = [arr[i], arr[k]];
      permute(arr, k + 1);
      [arr[k], arr[i]] = [arr[i], arr[k]];
    }
  };
  permute(idx, 0);
  return { order: best, totalCost: bestCost };
}

describe("orderRoute — trivial cases", () => {
  it("handles empty input", () => {
    expect(orderRoute([], [])).toEqual({ order: [], totalCost: 0 });
  });
  it("handles a single city", () => {
    expect(orderRoute(["A"], [[0]])).toEqual({ order: [0], totalCost: 0 });
  });
  it("throws on a malformed (non-square) matrix", () => {
    expect(() => orderRoute(["A", "B"], [[0, 1]])).toThrow(/rows/);
    expect(() => orderRoute(["A", "B"], [[0, 1], [1]])).toThrow(/columns/);
  });
});

describe("orderRoute — exact (Held-Karp) on small symmetric cases", () => {
  it("orders 4 collinear cities optimally regardless of input order", () => {
    // Cities on a line at positions 0,10,20,30 given in scrambled order [0,30,10,20].
    const pos = [0, 30, 10, 20];
    const cost: CostMatrix = pos.map((a) => pos.map((b) => Math.abs(a - b)));
    const res = orderRoute(["c0", "c30", "c10", "c20"], cost);
    // Optimal open path walks the line: total = 30 (0→10→20→30 in some direction).
    expect(res.totalCost).toBe(30);
    // Endpoints must be the two extremes (indices 0 and 1, positions 0 and 30).
    expect(new Set([res.order[0], res.order[res.order.length - 1]])).toEqual(new Set([0, 1]));
  });

  it("matches brute force on a random-ish symmetric 6-city matrix", () => {
    const cost: CostMatrix = [
      [0, 4, 8, 9, 12, 3],
      [4, 0, 6, 8, 10, 5],
      [8, 6, 0, 4, 3, 7],
      [9, 8, 4, 0, 5, 6],
      [12, 10, 3, 5, 0, 9],
      [3, 5, 7, 6, 9, 0],
    ];
    const res = orderRoute(["a", "b", "c", "d", "e", "f"], cost);
    const truth = bruteForce(cost);
    expect(res.totalCost).toBe(truth.totalCost);
  });
});

describe("orderRoute — asymmetric costs", () => {
  it("finds the cheaper direction when cost[i][j] !== cost[j][i]", () => {
    // 3 cities; going 'downhill' is cheap, 'uphill' is expensive.
    const cost: CostMatrix = [
      [0, 1, 1],
      [9, 0, 1],
      [9, 9, 0],
    ];
    const res = orderRoute(["A", "B", "C"], cost);
    const truth = bruteForce(cost);
    expect(res.totalCost).toBe(truth.totalCost);
    // Cheapest open path is 0→1→2 (1 + 1 = 2).
    expect(res.order).toEqual([0, 1, 2]);
    expect(res.totalCost).toBe(2);
  });
});

describe("orderRoute — Infinity (unavailable / infrequent legs)", () => {
  it("routes around a blocked direct leg via a detour", () => {
    // A↔C direct is unavailable (Infinity); must go A→B→C.
    const INF = Infinity;
    const cost: CostMatrix = [
      [0, 2, INF],
      [2, 0, 2],
      [INF, 2, 0],
    ];
    const res = orderRoute(["A", "B", "C"], cost, { fixedStart: 0, fixedEnd: 2 });
    expect(res.order).toEqual([0, 1, 2]);
    expect(res.totalCost).toBe(4);
  });

  it("returns Infinity cost when no valid path exists (disconnected)", () => {
    // City 2 is unreachable from everywhere.
    const INF = Infinity;
    const cost: CostMatrix = [
      [0, 1, INF],
      [1, 0, INF],
      [INF, INF, 0],
    ];
    const res = orderRoute(["A", "B", "C"], cost);
    expect(res.totalCost).toBe(Infinity);
    expect(res.order).toEqual([]);
  });
});

describe("orderRoute — anchors", () => {
  const cost: CostMatrix = [
    [0, 5, 8, 3],
    [5, 0, 4, 6],
    [8, 4, 0, 7],
    [3, 6, 7, 0],
  ];

  it("respects a fixed start city", () => {
    const res = orderRoute(["home", "b", "c", "d"], cost, { fixedStart: 0 });
    expect(res.order[0]).toBe(0);
    const truth = bruteForce(cost, { fixedStart: 0 });
    expect(res.totalCost).toBe(truth.totalCost);
  });

  it("respects both a fixed start and a fixed end", () => {
    const res = orderRoute(["home", "b", "c", "depart"], cost, { fixedStart: 0, fixedEnd: 3 });
    expect(res.order[0]).toBe(0);
    expect(res.order[res.order.length - 1]).toBe(3);
    const truth = bruteForce(cost, { fixedStart: 0, fixedEnd: 3 });
    expect(res.totalCost).toBe(truth.totalCost);
  });
});

describe("orderRoute — heuristic path (n > 10)", () => {
  it("produces a valid permutation and a reasonable cost for 12 cities", () => {
    // Build a 12-city symmetric matrix from random-ish 2D points (deterministic).
    const n = 12;
    const pts = Array.from({ length: n }, (_, i) => [(i * 37) % 100, (i * 53) % 100]);
    const cost: CostMatrix = pts.map(([ax, ay]) =>
      pts.map(([bx, by]) => Math.round(Math.hypot(ax - bx, ay - by)))
    );
    const res = orderRoute(pts.map((_, i) => `c${i}`), cost, { fixedStart: 0 });

    // Valid permutation of all 12 cities, starting at 0.
    expect(res.order).toHaveLength(n);
    expect(new Set(res.order).size).toBe(n);
    expect(res.order[0]).toBe(0);
    // 2-opt should beat the nearest-neighbor-only cost (sanity: finite + positive).
    expect(res.totalCost).toBeGreaterThan(0);
    expect(Number.isFinite(res.totalCost)).toBe(true);
    expect(pathCost(res.order, cost)).toBe(res.totalCost);
  });
});
