import test from "node:test";
import assert from "node:assert/strict";

import { applyFlightPreference } from "../lib/flightPrices";

const baseResult = {
  flights: [
    {
      airline: "Air A",
      origin: "HKG",
      destination: "SIN",
      departure_date: "2026-04-10",
      return_date: null,
      departure_time: "08:00",
      arrival_time: "12:00",
      duration: "4h 0m",
      stops: 1,
      delay: null,
      price: 420,
      currency: "USD",
      is_best: false,
    },
    {
      airline: "Air B",
      origin: "HKG",
      destination: "SIN",
      departure_date: "2026-04-10",
      return_date: null,
      departure_time: "09:00",
      arrival_time: "12:00",
      duration: "3h 0m",
      stops: 0,
      delay: null,
      price: 460,
      currency: "USD",
      is_best: true,
    },
    {
      airline: "Air C",
      origin: "HKG",
      destination: "SIN",
      departure_date: "2026-04-10",
      return_date: null,
      departure_time: "10:00",
      arrival_time: "15:00",
      duration: "5h 0m",
      stops: 1,
      delay: null,
      price: 350,
      currency: "USD",
      is_best: false,
    },
  ],
  current_price_level: "typical",
  error: null,
};

test("applyFlightPreference sorts by cheapest fare first", () => {
  const result = applyFlightPreference(baseResult, "cheapest");

  assert.equal(result.flights[0].airline, "Air C");
  assert.equal(result.flights[0].is_best, true);
  assert.equal(result.flights[1].is_best, false);
});

test("applyFlightPreference narrows to nonstop flights when available", () => {
  const result = applyFlightPreference(baseResult, "nonstop");

  assert.equal(result.flights.length, 1);
  assert.equal(result.flights[0].airline, "Air B");
  assert.equal(result.flights[0].stops, 0);
});

test("applyFlightPreference falls back to the cheapest option when no nonstop flights exist", () => {
  const result = applyFlightPreference(
    {
      ...baseResult,
      flights: baseResult.flights.filter((flight) => flight.airline !== "Air B"),
    },
    "nonstop"
  );

  assert.equal(result.flights.length, 2);
  assert.equal(result.flights[0].airline, "Air C");
});
