import test from "node:test";
import assert from "node:assert/strict";

import { buildBucketAwareDestinationCandidates } from "../lib/destinationFallbacks";
import { destinationMatchesTravelHint, getTravelHint } from "../lib/travelHints";

test("Shanghai with a 3 hour limit backfills from the east Asia fallback pool", () => {
  const hint = getTravelHint("Shanghai", 3);
  assert.ok(hint);

  const candidates = buildBucketAwareDestinationCandidates(
    [
      { city: "Lisbon", country: "Portugal", region: "Estremadura" },
      { city: "Rome", country: "Italy", region: "Lazio" },
      { city: "Athens", country: "Greece", region: "Attica" },
    ],
    hint,
    8
  );

  assert.ok(candidates.length >= 8);
  assert.ok(candidates.every((destination) => destinationMatchesTravelHint(destination, hint)));
  assert.ok(candidates.some((destination) => destination.city === "Tokyo"));
  assert.ok(candidates.some((destination) => destination.city === "Seoul"));
  assert.ok(candidates.some((destination) => destination.city === "Taipei"));
});
