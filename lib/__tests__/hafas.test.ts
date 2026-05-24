import { describe, it, expect } from "vitest";
import { toTrainEstimate } from "../hafas";
import type { LiveTrainResult } from "../hafas";

describe("toTrainEstimate", () => {
  it("converts live train data with price", () => {
    const live: LiveTrainResult = {
      minPrice: 40,
      currency: "EUR",
      duration: "4h 30m",
      departures: 5,
      operator: "ICE, TGV",
    };

    const result = toTrainEstimate(live);

    expect(result.minFare).toBe(40);
    expect(result.typicalFare).toBe(60); // 40 * 1.5
    expect(result.currency).toBe("EUR");
    expect(result.note).toContain("4h 30m");
    expect(result.note).toContain("ICE, TGV");
  });

  it("defaults minFare to 30 when price is null", () => {
    const live: LiveTrainResult = {
      minPrice: null,
      currency: "EUR",
      duration: "2h 15m",
      departures: 3,
      operator: "Rail",
    };

    const result = toTrainEstimate(live);

    expect(result.minFare).toBe(30);
    expect(result.typicalFare).toBe(45); // 30 * 1.5
  });
});
