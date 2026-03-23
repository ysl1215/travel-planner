import test from "node:test";
import assert from "node:assert/strict";

import { buildJsonCorrectionPrompts, requestJsonCorrection } from "../lib/aiFix";

test("buildJsonCorrectionPrompts includes the invalid JSON and schema-specific guidance", () => {
  const { systemPrompt, userPrompt } = buildJsonCorrectionPrompts(
    '{"foo":true}',
    [{ message: "must have property city" }],
    "itinerary",
    "Keep the fix minimal."
  );

  assert.match(systemPrompt, /JSON fixer assistant/);
  assert.match(userPrompt, /invalid JSON \(itinerary\)/);
  assert.match(userPrompt, /must have property city/);
  assert.match(userPrompt, /corrected JSON object/);
  assert.match(userPrompt, /Keep the fix minimal\./);
});

test("requestJsonCorrection forwards the composed prompts to the injected generator", async () => {
  const calls: Array<{ systemPrompt: string; userPrompt: string }> = [];
  const fixed = await requestJsonCorrection(
    '{"foo":true}',
    [{ message: "must have property city" }],
    "destinations",
    undefined,
    async (systemPrompt, userPrompt) => {
      calls.push({ systemPrompt, userPrompt });
      return '{"fixed":true}';
    }
  );

  assert.equal(fixed, '{"fixed":true}');
  assert.equal(calls.length, 1);
  assert.match(calls[0].systemPrompt, /JSON fixer assistant/);
  assert.match(calls[0].userPrompt, /corrected JSON array/);
});
