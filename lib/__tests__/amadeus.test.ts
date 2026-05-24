import { describe, it, expect } from "vitest";
import { cityToIataCode, toAccomEstimate } from "../amadeus";
import type { LiveHotelResult } from "../amadeus";

describe("cityToIataCode", () => {
  it("returns IATA city code for known cities", () => {
    expect(cityToIataCode("london")).toBe("LON");
    expect(cityToIataCode("paris")).toBe("PAR");
    expect(cityToIataCode("tokyo")).toBe("TYO");
  });

  it("is case-insensitive", () => {
    expect(cityToIataCode("LONDON")).toBe("LON");
    expect(cityToIataCode("London")).toBe("LON");
  });

  it("trims whitespace", () => {
    expect(cityToIataCode("  paris  ")).toBe("PAR");
  });

  it("falls back to airports.ts for cities not in the primary map", () => {
    // "porto" is now in CITY_TO_IATA directly
    expect(cityToIataCode("porto")).toBe("OPO");
    // Cities only in airports.ts should still resolve via fallback
    expect(cityToIataCode("chicago")).not.toBeNull();
  });

  it("returns null for unknown cities", () => {
    expect(cityToIataCode("atlantis")).toBeNull();
    expect(cityToIataCode("")).toBeNull();
  });
});

describe("toAccomEstimate", () => {
  it("uses static hostel price when city is provided and known", () => {
    const live: LiveHotelResult = {
      cheapest: 80,
      median: 150,
      expensive: 300,
      currency: "USD",
      sampleCount: 10,
    };

    const result = toAccomEstimate(live, "london");

    expect(result.hostel).toBe(30); // from static table, not 80 * 0.4
    expect(result.budget).toBe(80);
    expect(result.midrange).toBe(150);
    expect(result.currency).toBe("USD");
  });

  it("falls back to multiplier when city is not provided", () => {
    const live: LiveHotelResult = {
      cheapest: 80,
      median: 150,
      expensive: 300,
      currency: "USD",
      sampleCount: 10,
    };

    const result = toAccomEstimate(live);
    expect(result.hostel).toBe(32); // 80 * 0.4 (legacy fallback)
  });

  it("uses regional multiplier for cities not in any static table", () => {
    const live: LiveHotelResult = {
      cheapest: 25,
      median: 50,
      expensive: 100,
      currency: "USD",
      sampleCount: 5,
    };

    // "luang prabang" is not in accomEstimates static table
    const result = toAccomEstimate(live, "luang prabang");
    expect(result.hostel).toBeLessThan(live.cheapest);
    expect(result.hostel).toBeGreaterThan(0);
    expect(result.hostel).toBe(9); // Math.round(25 * 0.35)
  });

  it("uses static hostel price for cities in the accom table", () => {
    const live: LiveHotelResult = {
      cheapest: 120,
      median: 200,
      expensive: 400,
      currency: "USD",
      sampleCount: 8,
    };

    // Reykjavik is in static table with hostel=35
    const result = toAccomEstimate(live, "reykjavik");
    expect(result.hostel).toBe(35);
  });
});
