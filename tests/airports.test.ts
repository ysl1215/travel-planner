import test from "node:test";
import assert from "node:assert/strict";

import { resolveAirportCode } from "../lib/airports";

test("resolveAirportCode uses the manual override when provided", () => {
  assert.equal(resolveAirportCode("Shanghai", "pvg"), "PVG");
});

test("resolveAirportCode falls back to the city mapping when override is missing", () => {
  assert.equal(resolveAirportCode("Tokyo"), "NRT");
});
