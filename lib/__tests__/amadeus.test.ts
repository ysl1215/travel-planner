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
  it("converts live hotel data to AccomEstimate format", () => {
    const live: LiveHotelResult = {
      cheapest: 80,
      median: 150,
      expensive: 300,
      currency: "USD",
      sampleCount: 10,
    };

    const result = toAccomEstimate(live);

    expect(result.hostel).toBe(32); // 80 * 0.4
    expect(result.budget).toBe(80);
    expect(result.midrange).toBe(150);
    expect(result.currency).toBe("USD");
  });

  it("rounds the hostel estimate", () => {
    const live: LiveHotelResult = {
      cheapest: 73,
      median: 120,
      expensive: 250,
      currency: "EUR",
      sampleCount: 5,
    };

    const result = toAccomEstimate(live);
    expect(result.hostel).toBe(29); // Math.round(73 * 0.4)
  });
});
