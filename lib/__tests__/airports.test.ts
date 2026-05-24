import { describe, it, expect } from "vitest";
import { cityToAirport } from "../airports";

describe("cityToAirport", () => {
  it("returns the IATA code for a known city", () => {
    expect(cityToAirport("London")).toBe("LHR");
    expect(cityToAirport("Tokyo")).toBe("NRT");
    expect(cityToAirport("Paris")).toBe("CDG");
  });

  it("is case-insensitive", () => {
    expect(cityToAirport("LONDON")).toBe("LHR");
    expect(cityToAirport("london")).toBe("LHR");
    expect(cityToAirport("London")).toBe("LHR");
  });

  it("trims whitespace", () => {
    expect(cityToAirport("  London  ")).toBe("LHR");
  });

  it("handles compound names by matching first word", () => {
    expect(cityToAirport("London, UK")).toBe("LHR");
    expect(cityToAirport("Paris, France")).toBe("CDG");
  });

  it("returns undefined for unknown cities", () => {
    expect(cityToAirport("Atlantis")).toBeUndefined();
    expect(cityToAirport("")).toBeUndefined();
  });

  it("handles cities with special characters", () => {
    expect(cityToAirport("kraków")).toBe("KRK");
  });
});
