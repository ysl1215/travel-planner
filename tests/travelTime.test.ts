import test from "node:test";
import assert from "node:assert/strict";

import { resolveDestinationTravelTime } from "../lib/travelTime";

test("resolveDestinationTravelTime blocks fallback hours when live lookup fails under a travel limit", () => {
  const resolved = resolveDestinationTravelTime(
    {
      id: "paris",
      city: "Paris",
      country: "France",
      rationale: "",
      highlights: [],
      estimatedFlightHours: 2.5,
      estimatedBudgetFit: "good",
      bestTimeToVisit: "",
      vibeMatch: [],
      imageQuery: "",
      verifiedThroughLiveSearch: false,
    },
    { hours: null, verifiedThroughLiveSearch: false, fromCache: false },
    {
      hasTravelLimit: true,
      shouldCheckLiveFlightPrices: true,
      canVerifyLiveFlightHours: true,
    }
  );

  assert.equal(resolved.hours, 3);
  assert.equal(resolved.destination.estimatedFlightHours, 3);
  assert.equal(resolved.destination.verifiedThroughLiveSearch, false);
});

test("resolveDestinationTravelTime keeps the estimate when live verification is disabled", () => {
  const resolved = resolveDestinationTravelTime(
    {
      id: "paris",
      city: "Paris",
      country: "France",
      rationale: "",
      highlights: [],
      estimatedFlightHours: 2.5,
      estimatedBudgetFit: "good",
      bestTimeToVisit: "",
      vibeMatch: [],
      imageQuery: "",
    },
    { hours: null, verifiedThroughLiveSearch: false, fromCache: false },
    {
      hasTravelLimit: false,
      shouldCheckLiveFlightPrices: false,
      canVerifyLiveFlightHours: false,
    }
  );

  assert.equal(resolved.hours, 2.5);
});

test("resolveDestinationTravelTime uses live hours when available", () => {
  const resolved = resolveDestinationTravelTime(
    {
      id: "paris",
      city: "Paris",
      country: "France",
      rationale: "",
      highlights: [],
      estimatedFlightHours: 2.5,
      estimatedBudgetFit: "good",
      bestTimeToVisit: "",
      vibeMatch: [],
      imageQuery: "",
    },
    { hours: 11.5, verifiedThroughLiveSearch: true, fromCache: false },
    {
      hasTravelLimit: true,
      shouldCheckLiveFlightPrices: true,
      canVerifyLiveFlightHours: true,
    }
  );

  assert.equal(resolved.hours, 11.5);
  assert.equal(resolved.destination.estimatedFlightHours, 11.5);
  assert.equal(resolved.destination.verifiedThroughLiveSearch, true);
});
