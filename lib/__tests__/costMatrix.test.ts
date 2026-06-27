import { describe, it, expect, vi, afterEach } from "vitest";
import { buildCostMatrix } from "../costMatrix";

// London, Paris, Rome are all in flightTime.ts's static CITY_COORDS table, so these
// resolve via great-circle math with NO network call.
const KNOWN = ["London", "Paris", "Rome"];

describe("buildCostMatrix — structure", () => {
  it("builds a square matrix with a zero diagonal", async () => {
    const { cities, cost } = await buildCostMatrix(KNOWN);
    expect(cities).toEqual(KNOWN);
    expect(cost).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      expect(cost[i]).toHaveLength(3);
      expect(cost[i][i]).toBe(0);
    }
  });

  it("seeds symmetric great-circle hours for known cities", async () => {
    const { cost, unresolved } = await buildCostMatrix(KNOWN);
    // Symmetric seed.
    expect(cost[0][1]).toBe(cost[1][0]);
    expect(cost[0][2]).toBe(cost[2][0]);
    // London→Paris is much shorter than London→Rome.
    expect(cost[0][1]).toBeLessThan(cost[0][2]);
    // All known → nothing unresolved.
    expect(unresolved).toEqual([]);
    // Positive finite hours.
    expect(cost[0][1]).toBeGreaterThan(0);
    expect(Number.isFinite(cost[0][2])).toBe(true);
  });
});

describe("buildCostMatrix — unavailable legs", () => {
  it("marks a directed unavailable leg as Infinity, leaving the reverse finite", async () => {
    const { cost } = await buildCostMatrix(KNOWN, {
      unavailable: [{ from: "London", to: "Rome" }],
    });
    expect(cost[0][2]).toBe(Infinity); // London → Rome blocked
    expect(cost[2][0]).not.toBe(Infinity); // Rome → London still available
  });

  it("matches unavailable legs case-insensitively", async () => {
    const { cost } = await buildCostMatrix(KNOWN, {
      unavailable: [{ from: "  paris ", to: "ROME" }],
    });
    expect(cost[1][2]).toBe(Infinity);
  });
});

describe("buildCostMatrix — unresolved legs", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("falls back to a finite unknownLegCost when a leg can't be estimated", async () => {
    // Mock the estimator to fail for any leg involving the fictional city.
    const mod = await import("../flightTime");
    vi.spyOn(mod, "estimateFlightHoursAsync").mockResolvedValue(null);
    // Keep the test offline: buildCostMatrix now warms the geocode cache up front, which
    // would otherwise hit Nominatim for these fictional cities.
    vi.spyOn(mod, "warmGeocodeCache").mockResolvedValue(undefined);

    const { cost, unresolved } = await buildCostMatrix(["Atlantis", "El Dorado"], {
      unknownLegCost: 99,
    });
    expect(cost[0][1]).toBe(99);
    expect(cost[1][0]).toBe(99);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]).toMatchObject({ from: "Atlantis", to: "El Dorado" });
  });
});
