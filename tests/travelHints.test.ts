import test from "node:test";
import assert from "node:assert/strict";

import { destinationMatchesTravelHint, getTravelHint } from "../lib/travelHints";

test("getTravelHint classifies Shanghai as strict east asia for short limits", () => {
  const hint = getTravelHint("Shanghai", 3);
  assert.ok(hint);
  assert.equal(hint?.bucket, "east-asia");
  assert.equal(hint?.strict, true);
});

test("destinationMatchesTravelHint rejects Europe and allows nearby Asia for Shanghai", () => {
  const hint = getTravelHint("Shanghai", 3);
  assert.equal(
    destinationMatchesTravelHint({ country: "France", region: "Europe" }, hint),
    false
  );
  assert.equal(
    destinationMatchesTravelHint({ country: "Japan", region: "East Asia" }, hint),
    true
  );
});
