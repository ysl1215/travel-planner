import test from "node:test";
import assert from "node:assert/strict";

import { summarizeGoogleFlightsError } from "../lib/googleFlightsErrors";

test("summarizeGoogleFlightsError converts html-like scrape dumps into a safe response", () => {
  const summary = summarizeGoogleFlightsError(
    "Google Flights scraping failed: No flights found: Skip to main contentAccessibility feedback Travel Explore Flights Hotels"
  );

  assert.equal(summary.kind, "no_flights");
  assert.equal(
    summary.message,
    "Google Flights temporarily returned an unusable response. Try again later or change the dates."
  );
});

test("summarizeGoogleFlightsError keeps plain no-flight messages concise", () => {
  const summary = summarizeGoogleFlightsError("No flights found for your selected route.");

  assert.equal(summary.kind, "no_flights");
  assert.equal(summary.message, "No flights found for these dates.");
});
