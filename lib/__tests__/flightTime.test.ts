import { describe, it, expect } from "vitest";
import { estimateFlightHours, checkReachability, hasCoordinates } from "../flightTime";

describe("estimateFlightHours", () => {
  it("returns a reasonable estimate for a known short-haul route", () => {
    const hours = estimateFlightHours("London", "Paris");
    expect(hours).not.toBeNull();
    expect(hours!).toBeGreaterThan(0.5);
    expect(hours!).toBeLessThan(2.5);
  });

  it("returns a reasonable estimate for a known long-haul route", () => {
    const hours = estimateFlightHours("London", "Tokyo");
    expect(hours).not.toBeNull();
    expect(hours!).toBeGreaterThan(10);
    expect(hours!).toBeLessThan(16);
  });

  it("handles city aliases (e.g. NYC -> New York)", () => {
    const direct = estimateFlightHours("New York", "London");
    const alias = estimateFlightHours("NYC", "London");
    expect(direct).toEqual(alias);
  });

  it("handles IATA code aliases", () => {
    const result = estimateFlightHours("LHR", "CDG");
    expect(result).not.toBeNull();
  });

  it("is case-insensitive", () => {
    const lower = estimateFlightHours("london", "paris");
    const mixed = estimateFlightHours("LONDON", "Paris");
    expect(lower).toEqual(mixed);
  });

  it("returns null for unknown cities", () => {
    const result = estimateFlightHours("Atlantis", "London");
    expect(result).toBeNull();
  });

  it("returns null when both cities are unknown", () => {
    const result = estimateFlightHours("Narnia", "Atlantis");
    expect(result).toBeNull();
  });

  it("returns ~0.5h for very short distances", () => {
    const result = estimateFlightHours("Milan", "Venice");
    expect(result).not.toBeNull();
    expect(result!).toBeLessThanOrEqual(1.5);
  });
});

describe("checkReachability", () => {
  it("marks a short route as reachable within 5 hours", () => {
    const result = checkReachability("London", "Paris", 5);
    expect(result).not.toBeNull();
    expect(result!.reachable).toBe(true);
    expect(result!.estimatedHours).toBeLessThan(5);
  });

  it("marks a long route as not reachable within 3 hours", () => {
    const result = checkReachability("London", "Tokyo", 3);
    expect(result).not.toBeNull();
    expect(result!.reachable).toBe(false);
  });

  it("returns null for unknown cities", () => {
    const result = checkReachability("Atlantis", "London", 5);
    expect(result).toBeNull();
  });
});

describe("hasCoordinates", () => {
  it("returns true for a known city", () => {
    expect(hasCoordinates("London")).toBe(true);
  });

  it("returns true for an alias", () => {
    expect(hasCoordinates("NYC")).toBe(true);
  });

  it("returns false for an unknown city", () => {
    expect(hasCoordinates("Atlantis")).toBe(false);
  });
});
