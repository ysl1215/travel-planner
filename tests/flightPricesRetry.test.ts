import test from "node:test";
import assert from "node:assert/strict";

import { isRetryableGoogleFlightsError } from "../lib/flightPrices";

test("isRetryableGoogleFlightsError flags scraper-blocking responses", () => {
  assert.equal(
    isRetryableGoogleFlightsError("Google Flights temporarily returned an unusable response. Try again later."),
    true
  );
  assert.equal(
    isRetryableGoogleFlightsError("No flights found: Skip to main contentAccessibility feedback"),
    true
  );
});

test("isRetryableGoogleFlightsError treats no-result messages as retryable", () => {
  assert.equal(isRetryableGoogleFlightsError("No flights found for these dates."), true);
});
