/**
 * Helper for requesting JSON corrections from the model when responses fail schema validation.
 */

import { generate } from "@/lib/ai";

export function buildJsonCorrectionPrompts(
  invalidJson: string,
  ajvErrors: unknown,
  schemaName: string,
  extra?: string
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt =
    "You are a JSON fixer assistant. Given invalid JSON and validation errors, produce a corrected JSON matching the expected structure. Output ONLY the corrected JSON — no explanation, no markdown, no code fences.";

  let userPrompt = `The model previously returned the following invalid JSON (${schemaName}):\n\n${invalidJson}\n\nValidation errors:\n${JSON.stringify(ajvErrors, null, 2)}\n\nPlease return a corrected ${schemaName === "itinerary" ? "JSON object" : "JSON array"} only that conforms to the expected schema. Output ONLY the JSON.`;

  if (extra) userPrompt += `\n\n${extra}`;

  return { systemPrompt, userPrompt };
}

export async function requestJsonCorrection(
  invalidJson: string,
  ajvErrors: unknown,
  schemaName: string,
  extra?: string,
  generateFn: typeof generate = generate
): Promise<string> {
  const { systemPrompt, userPrompt } = buildJsonCorrectionPrompts(invalidJson, ajvErrors, schemaName, extra);
  return generateFn(systemPrompt, userPrompt);
}
