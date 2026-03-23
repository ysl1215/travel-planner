import test from "node:test";
import assert from "node:assert/strict";

import {
  computeMissingClosers,
  extractCandidateItems,
  extractJsonByFirstBracket,
  extractJsonCandidate,
  sanitizeJsonTrailingCommas,
  sanitizeRepair,
} from "../lib/jsonExtraction";

test("extractJsonCandidate finds an array inside surrounding text", () => {
  const text = "prefix\n```json\n[{\"city\":\"Lisbon\"}]\n```\nsuffix";
  assert.equal(extractJsonCandidate(text), "[{\"city\":\"Lisbon\"}]");
});

test("sanitizeRepair removes trailing commas and closes missing brackets", () => {
  assert.equal(sanitizeJsonTrailingCommas('[{"city":"Lisbon",},]'), '[{"city":"Lisbon"}]');
  assert.equal(computeMissingClosers('[{"city":"Lisbon"'), "}]");
  assert.equal(sanitizeRepair('[{"city":"Lisbon",'), '[{"city":"Lisbon"}]');
});

test("extractJsonByFirstBracket handles nested objects", () => {
  const text = 'noise {"a":{"b":[1,2,3]}} more noise';
  assert.equal(extractJsonByFirstBracket(text, "{"), '{"a":{"b":[1,2,3]}}');
});

test("extractCandidateItems unwraps common object keys", () => {
  assert.deepEqual(extractCandidateItems({ destinations: [{ city: "Lisbon" }] }), [{ city: "Lisbon" }]);
  assert.deepEqual(extractCandidateItems({ data: [{ city: "Tokyo" }] }), [{ city: "Tokyo" }]);
  assert.deepEqual(extractCandidateItems([{ city: "Paris" }]), [{ city: "Paris" }]);
});
