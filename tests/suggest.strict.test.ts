import test from "node:test";
import assert from "node:assert/strict";

// Ensure simulation env is set so lookupFlightHours returns null
process.env.SUGGEST_ALLOW_FALLBACK_UNDER_LIMIT = "false";
process.env.SIMULATE_FLIGHT_LOOKUP_FAILURE = "true";

import { resolveDestinationTravelTime } from "../lib/travelTime";
import { buildBucketAwareDestinationCandidates } from "../lib/destinationFallbacks";
import { getTravelHint } from "../lib/travelHints";
import Ajv from "ajv";
import destinationsSchema from "../lib/schemas/destinations.schema.json";

const ajv = new Ajv();
const validateDestinations = ajv.compile(destinationsSchema);

test("strict-mode would trigger 'no destinations' when live lookups fail and fallbacks disallowed", () => {
  const dummy = {
    id: "x",
    city: "Unknown City",
    country: "Nowhere",
    rationale: "",
    highlights: [],
    estimatedFlightHours: 2.5,
    estimatedBudgetFit: "good",
    bestTimeToVisit: "",
    vibeMatch: [],
    imageQuery: "",
  } as any;

  const resolved = resolveDestinationTravelTime(dummy, { hours: null, verifiedThroughLiveSearch: false, fromCache: false }, {
    hasTravelLimit: true,
    shouldCheckLiveFlightPrices: true,
    canVerifyLiveFlightHours: false,
    allowFallbackUnderLimit: false,
  });

  // In strict mode a failed lookup is treated as infinite travel time
  assert.equal(resolved.hours, Number.POSITIVE_INFINITY);

  // Fallback candidates are available but forbidden under strict mode; validate that they would be considered
  const travelHint = getTravelHint("Shanghai", 3);
  const fallback = buildBucketAwareDestinationCandidates([], travelHint, 8);
  assert.ok(validateDestinations(fallback));
});
