import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchFlights, isConfigured } from "../duffel";

// A minimal Duffel offer_requests response with two offers (one cheaper, one with a stop).
function mockDuffelResponse() {
  return {
    data: {
      offers: [
        {
          id: "off_pricier",
          total_amount: "320.00",
          total_currency: "GBP",
          owner: { name: "British Airways" },
          slices: [
            {
              segments: [
                {
                  departing_at: "2026-07-01T08:30:00",
                  arriving_at: "2026-07-01T11:45:00",
                  duration: "PT3H15M",
                  marketing_carrier: { name: "British Airways" },
                },
              ],
            },
          ],
        },
        {
          id: "off_cheaper",
          total_amount: "180.50",
          total_currency: "GBP",
          owner: { name: "Vueling" },
          slices: [
            {
              segments: [
                {
                  departing_at: "2026-07-01T06:00:00",
                  arriving_at: "2026-07-01T08:00:00",
                  duration: "PT2H0M",
                  marketing_carrier: { name: "Vueling" },
                },
                {
                  departing_at: "2026-07-01T09:00:00",
                  arriving_at: "2026-07-01T10:30:00",
                  duration: "PT1H30M",
                  marketing_carrier: { name: "Vueling" },
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

const baseParams = {
  origin: "LHR",
  destination: "BCN",
  departure: "2026-07-01",
  adults: 1,
  currency: "GBP",
};

describe("duffel isConfigured", () => {
  afterEach(() => { delete process.env.DUFFEL_API_TOKEN; });

  it("is false without a token", () => {
    delete process.env.DUFFEL_API_TOKEN;
    expect(isConfigured()).toBe(false);
  });

  it("is true with a token", () => {
    process.env.DUFFEL_API_TOKEN = "test_tok";
    expect(isConfigured()).toBe(true);
  });
});

describe("duffel searchFlights — not configured", () => {
  it("returns an error and no flights without a token", async () => {
    delete process.env.DUFFEL_API_TOKEN;
    const res = await searchFlights(baseParams);
    expect(res.flights).toEqual([]);
    expect(res.error).toMatch(/not configured/i);
  });
});

describe("duffel searchFlights — mapping", () => {
  beforeEach(() => { process.env.DUFFEL_API_TOKEN = "test_tok"; });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.DUFFEL_API_TOKEN; });

  it("maps offers to FlightOffer, sorts cheapest-first, and flags isBest", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => mockDuffelResponse(),
    })));

    const res = await searchFlights(baseParams);
    expect(res.error).toBeNull();
    expect(res.flights).toHaveLength(2);

    // Cheapest first.
    const [best, second] = res.flights;
    expect(best.price).toBe(180.5);
    expect(best.airline).toBe("Vueling");
    expect(best.isBest).toBe(true);
    expect(second.price).toBe(320);
    expect(second.isBest).toBe(false);

    // Stops: 2 segments on the cheaper offer's outbound slice => 1 stop.
    expect(best.stops).toBe(1);
    // 1 segment on the pricier offer => nonstop.
    expect(second.stops).toBe(0);

    // Times extracted (HH:MM) and currency passed through.
    expect(best.departureTime).toBe("06:00");
    expect(best.arrivalTime).toBe("10:30"); // arrival of the LAST segment
    expect(best.currency).toBe("GBP");

    // Duration summed across segments: 2h + 1h30 = 3h 30m.
    expect(best.duration).toBe("3h 30m");
    // Single-segment offer: 3h 15m.
    expect(second.duration).toBe("3h 15m");
  });

  // Pull the JSON request body out of a captured fetch(url, init) call.
  function lastRequestBody(fetchMock: ReturnType<typeof vi.fn>): any {
    const call = fetchMock.mock.calls[0] as [string, { body: string }];
    return JSON.parse(call[1].body);
  }

  it("sends a return slice for round trips", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => mockDuffelResponse() }));
    vi.stubGlobal("fetch", fetchMock);

    await searchFlights({ ...baseParams, returnDate: "2026-07-08" });
    const body = lastRequestBody(fetchMock);
    expect(body.data.slices).toHaveLength(2);
    expect(body.data.slices[1]).toMatchObject({ origin: "BCN", destination: "LHR", departure_date: "2026-07-08" });
  });

  it("maps the premium-economy cabin to Duffel's premium_economy enum", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => mockDuffelResponse() }));
    vi.stubGlobal("fetch", fetchMock);

    await searchFlights({ ...baseParams, seat: "premium-economy" });
    const body = lastRequestBody(fetchMock);
    expect(body.data.cabin_class).toBe("premium_economy");
  });

  it("returns an error on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => "invalid token",
    })));

    const res = await searchFlights(baseParams);
    expect(res.flights).toEqual([]);
    expect(res.error).toMatch(/Duffel API error 401/);
  });

  it("handles an empty offers array gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { offers: [] } }),
    })));

    const res = await searchFlights(baseParams);
    expect(res.error).toBeNull();
    expect(res.flights).toEqual([]);
  });
});
