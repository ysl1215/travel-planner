/**
 * Helper for requesting JSON corrections from the model when responses fail schema validation.
 * Caches the first correction attempt per schema to avoid redundant LLM calls in retry loops.
 */

import { generate } from "@/lib/ai";

const SCHEMA_HINTS: Record<string, string> = {
  destinations: `JSON array where each item has: id(string), country(string), city(string), airportCode(3-letter IATA, optional), rationale(string), highlights(string[]), estimatedFlightHours(number), estimatedBudgetFit("excellent"|"good"|"stretch"), bestTimeToVisit(string), vibeMatch(string[]), imageQuery(string)`,
  itinerary: `JSON object with: destination(string), totalDays(number), overview(string), days(array of day objects with day/location/theme/morning/afternoon/evening arrays), clusters(optional array), topAttractions(array), foodRecommendations(array), route(array), practicalTips(string[]), bestTimeToVisit(string)`,
};

// Per-request cache: keyed on truncated input hash to avoid re-calling LLM with same broken JSON
const _correctionCache = new Map<string, string>();
const CACHE_MAX = 20;

function cacheKey(invalidJson: string, schemaName: string): string {
  // Simple hash: first 100 chars + schema name
  return `${schemaName}:${invalidJson.slice(0, 100)}`;
}

export async function requestJsonCorrection(
  invalidJson: string,
  ajvErrors: any,
  schemaName: string,
  extra?: string
): Promise<string> {
  const key = cacheKey(invalidJson, schemaName);
  const cached = _correctionCache.get(key);
  if (cached) return cached;

  const truncated = invalidJson.length > 500 ? invalidJson.slice(0, 500) + "…" : invalidJson;
  const schemaHint = SCHEMA_HINTS[schemaName] ?? schemaName;

  const errorSummary = Array.isArray(ajvErrors) && ajvErrors.length > 0
    ? ajvErrors.slice(0, 5).map((e: any) => `${e.instancePath || "root"}: ${e.message}`).join("; ")
    : "invalid or incomplete JSON";

  const userPrompt = `Fix this invalid JSON for a ${schemaName} (${schemaHint}).
Errors: ${errorSummary}
JSON: ${truncated}${extra ? `\n${extra}` : ""}
Return ONLY the corrected JSON.`;

  const result = await generate(
    "You are a JSON fixer. Output ONLY the corrected JSON — no explanation, no markdown, no code fences.",
    userPrompt,
    undefined,
    { preferShortFirst: true, temperature: 0.2 }
  );

  // Cache result (evict oldest if full)
  if (_correctionCache.size >= CACHE_MAX) {
    const firstKey = _correctionCache.keys().next().value;
    if (firstKey) _correctionCache.delete(firstKey);
  }
  _correctionCache.set(key, result);

  return result;
}
