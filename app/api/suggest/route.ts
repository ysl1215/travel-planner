import { NextRequest, NextResponse } from "next/server";
import Ajv from "ajv";
import destinationsSchema from "@/lib/schemas/destinations.schema.json";
import { generate } from "@/lib/ai";
import { requestJsonCorrection } from "@/lib/aiFix";
import { buildDestinationPrompt, DESTINATION_SCHEMA_EXAMPLE } from "@/lib/prompts";
import { TripPlannerInput, Destination } from "@/lib/types";
import { rateLimit } from "@/lib/rateLimit";
import { queueCity } from "@/lib/db";
import { estimateFlightHours, estimateFlightHoursAsync, sanityCheckFlightHours, warmGeocodeCache } from "@/lib/flightTime";
import { scoreAndSortDestinations } from "@/lib/preferenceMatch";
import { createTtlCache } from "@/lib/ttlCache";

const ajv = new Ajv();
const validateDestinations = ajv.compile(destinationsSchema as any);

// Response cache: avoids re-generating for identical inputs
const suggestCache = createTtlCache<any>({ ttlMs: 10 * 60 * 1000, max: 50 });

function buildCacheKey(input: TripPlannerInput): string {
  const sig = [
    input.homeCity, input.budget, input.currency,
    input.startDate, input.endDate,
    (input.likedActivities ?? []).sort().join(","),
    (input.dislikedActivities ?? []).sort().join(","),
    input.travelPriorities,
    input.maxTravelHours ?? "",
    input.country ?? "",
    input.travelStyle,
    input.preferHiddenGems ? "1" : "0",
  ].join("|");
  // Simple hash
  let hash = 0;
  for (let i = 0; i < sig.length; i++) {
    hash = ((hash << 5) - hash + sig.charCodeAt(i)) | 0;
  }
  return String(hash);
}

function getCachedResponse(key: string): any | null {
  return suggestCache.get(key);
}

function setCachedResponse(key: string, data: any) {
  suggestCache.set(key, data);
}

/**
 * Override AI-reported flight hours with independent great-circle estimates
 * where possible, then filter out destinations exceeding the constraint.
 * Uses Nominatim geocoding as fallback for cities not in the static table.
 */
async function correctAndFilterByTravelTime(
  destinations: Destination[],
  homeCity: string,
  maxHours?: number
): Promise<Destination[]> {
  // Warm the geocode cache for homeCity + all destination cities in one rate-limited
  // pass (≤ N+1 network calls), so the per-destination estimateFlightHoursAsync calls
  // below are pure cache hits instead of serialized 1.1s-staggered geocodes.
  await warmGeocodeCache([homeCity, ...destinations.map((d) => d.city)]);

  // Correct flight hours using independent calculation
  for (const d of destinations) {
    // Try static table first (fast, no network)
    const staticEstimate = estimateFlightHours(homeCity, d.city);
    if (staticEstimate !== null) {
      d.estimatedFlightHours = staticEstimate;
    } else {
      // Fallback to async geocoding for unknown cities
      const asyncEstimate = await estimateFlightHoursAsync(homeCity, d.city);
      if (asyncEstimate !== null) {
        d.estimatedFlightHours = asyncEstimate;
      } else {
        // Last resort: country-based sanity check to catch hallucinated flight times
        const corrected = sanityCheckFlightHours(homeCity, d.country, d.estimatedFlightHours);
        if (corrected !== null) {
          d.estimatedFlightHours = corrected;
        }
      }
    }
  }

  if (!maxHours || maxHours <= 0) return destinations;
  const limit = maxHours * 1.2; // 20% buffer for routing/layovers
  return destinations.filter((d) => d.estimatedFlightHours <= limit);
}

/** Return destinations response and auto-queue cities for scraping. */
function destinationsResponse(destinations: Destination[], cacheKey?: string) {
  // Fire-and-forget: queue each city (no-op if DB not initialised or already queued)
  for (const d of destinations) {
    try { queueCity(d.city, d.country); } catch { /* DB may not exist yet — skip */ }
  }
  const data = { destinations };
  if (cacheKey) setCachedResponse(cacheKey, data);
  return NextResponse.json(data);
}

/**
 * If all destinations were filtered out by travel time, re-prompt the AI
 * with stricter geographic constraints. Returns null if re-prompt isn't needed.
 */
async function handleEmptyFilterResult(
  filtered: Destination[],
  unfilteredCount: number,
  input: TripPlannerInput
): Promise<NextResponse | null> {
  if (filtered.length > 0 || unfilteredCount === 0) return null;
  if (!input.maxTravelHours) return null;

  console.warn(
    `All ${unfilteredCount} destinations filtered out (max ${input.maxTravelHours}h from ${input.homeCity}). Re-prompting with strict constraint.`
  );

  const retryPrompt = `You previously suggested destinations that were ALL too far from ${input.homeCity} (max ${input.maxTravelHours}h direct flight).

STRICT REQUIREMENT: Only suggest cities reachable within ${input.maxTravelHours} hours of non-stop flight from ${input.homeCity}. This is approximately ${Math.round(input.maxTravelHours * 750)}km radius.

Think carefully about geography. ${input.homeCity} is in ${guessRegion(input.homeCity)}. A ${input.maxTravelHours}h flight covers roughly:
- 1-2h: nearby cities in the same country or adjacent countries
- 3-4h: same continent, neighbouring regions
- 5-6h: same continent, far side or nearby continent

User preferences: ${input.travelPriorities || "general tourism"}
Likes: ${input.likedActivities?.join(", ") || "not specified"}
Budget: ${input.budget} ${input.currency}
Style: ${input.travelStyle || "balanced"}

Return 3-6 destinations as a JSON array. Same schema as before:
${DESTINATION_SCHEMA_EXAMPLE}`;

  try {
    const raw = await generate(
      "You are an expert travel planner. You MUST only suggest cities within the flight time constraint. Respond with valid JSON only.",
      retryPrompt,
      undefined,
      { taskType: "suggest_retry" }
    );

    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return null;

    const parsed: Destination[] = JSON.parse(match[0]);
    const refiltered = await correctAndFilterByTravelTime(parsed, input.homeCity, input.maxTravelHours);

    if (refiltered.length > 0) {
      return destinationsResponse(refiltered);
    }
  } catch (err) {
    console.error("Re-prompt for nearby destinations failed:", err);
  }

  return null;
}

/**
 * When most destinations don't match user preferences, re-prompt for better alternatives.
 */
async function handleLowPreferenceMatch(
  matched: Destination[],
  deprioritised: Destination[],
  input: TripPlannerInput
): Promise<NextResponse | null> {
  const needed = 4 - matched.length;
  const avoidCities = deprioritised.map((d) => d.city).join(", ");
  const avoidActivities = (input.dislikedActivities ?? []).join(", ");
  const likedActivities = (input.likedActivities ?? []).join(", ");

  const retryPrompt = `Your previous suggestions did not match the user's preferences well. Please suggest ${needed} MORE destinations.

DO NOT suggest these cities (already suggested): ${avoidCities}
The user AVOIDS these activities: ${avoidActivities || "none specified"}
The user LIKES: ${likedActivities || "general tourism"}
${input.preferHiddenGems ? "The user wants OFF-THE-BEATEN-PATH destinations — avoid major tourist cities." : ""}

User profile:
- Home: ${input.homeCity}
- Budget: ${input.budget} ${input.currency} for ${input.travelers} traveler(s)
- Style: ${input.travelStyle}
${input.maxTravelHours ? `- Max flight: ${input.maxTravelHours}h` : ""}
${input.country ? `- Preferred region: ${input.country}` : ""}

Each destination's vibeMatch MUST include activities from the user's Likes list.

Return a JSON array only. Each item:
${DESTINATION_SCHEMA_EXAMPLE}`;

  try {
    const raw = await generate(
      "You are an expert travel planner. Match the user's activity preferences precisely. Respond with valid JSON only.",
      retryPrompt,
      undefined,
      { taskType: "suggest_preference_retry" }
    );

    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return null;

    const parsed: Destination[] = JSON.parse(match[0]);
    const refiltered = await correctAndFilterByTravelTime(parsed, input.homeCity, input.maxTravelHours);

    if (refiltered.length > 0) {
      // Score the new batch too
      const { matched: newMatched } = scoreAndSortDestinations(
        refiltered,
        input.likedActivities ?? [],
        input.dislikedActivities ?? [],
        input.preferHiddenGems ?? false
      );
      // Combine: original matched + new matched + deprioritised as fallback
      const combined = [...matched, ...newMatched, ...deprioritised];
      return destinationsResponse(combined.slice(0, 6));
    }
  } catch (err) {
    console.warn("Preference re-prompt failed:", err instanceof Error ? err.message : err);
  }

  return null;
}

function guessRegion(city: string): string {
  const c = city.toLowerCase();
  if (/shanghai|beijing|guangzhou|shenzhen|chengdu|hong kong|taipei|china/.test(c)) return "East Asia (China region)";
  if (/tokyo|osaka|japan/.test(c)) return "East Asia (Japan)";
  if (/seoul|busan|korea/.test(c)) return "East Asia (Korea)";
  if (/bangkok|singapore|kuala lumpur|hanoi|manila|jakarta|bali|vietnam|thailand|malaysia/.test(c)) return "Southeast Asia";
  if (/mumbai|delhi|india|colombo|kathmandu/.test(c)) return "South Asia";
  if (/dubai|doha|riyadh|istanbul|cairo/.test(c)) return "Middle East";
  if (/london|paris|berlin|rome|madrid|amsterdam|vienna/.test(c)) return "Europe";
  if (/new york|los angeles|chicago|toronto|miami/.test(c)) return "North America";
  if (/sydney|melbourne|auckland/.test(c)) return "Oceania";
  if (/sao paulo|buenos aires|lima|bogota/.test(c)) return "South America";
  if (/johannesburg|nairobi|cape town|lagos/.test(c)) return "Africa";
  return "their region";
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(ip, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  try {
    const input: TripPlannerInput = await request.json();

    if (!input.budget || !input.homeCity || !input.travelers) {
      return NextResponse.json(
        { error: "Missing required fields: budget, homeCity, travelers" },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = buildCacheKey(input);
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const prompt = buildDestinationPrompt(input);
    // 4-6 destination objects ≈ 800-1200 output tokens; the default 4096 ceiling is 3-4×
    // headroom that just lets the model ramble. 2048 is comfortable for the array.
    const raw = await generate(
      "You are an expert travel planner with accurate knowledge of real-world flight durations. Always respond with valid JSON only.",
      prompt,
      undefined,
      { tokenCandidates: [2048, 1024, 256], taskType: "suggest" }
    );

    // Robust JSON extraction and parsing for arrays
    function extractJsonByFirstBracket(text: string, startChar: "{" | "["): string | null {
      const opening = startChar;
      const closing = startChar === "{" ? "}" : "]";
      const startIndex = text.indexOf(opening);
      if (startIndex === -1) return null;
      let depth = 0;
      let inString = false;
      for (let i = startIndex; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"' && text[i - 1] !== "\\") inString = !inString;
        if (inString) continue;
        if (ch === opening) depth++;
        else if (ch === closing) {
          depth--;
          if (depth === 0) return text.slice(startIndex, i + 1);
        }
      }
      return null;
    }

    function sanitizeJsonTrailingCommas(s: string): string {
      return s.replace(/,\s*(?=[}\]])/g, "");
    }

    let candidate = extractJsonByFirstBracket(raw, "[") ?? (raw.match(/\[[\s\S]*\]/)?.[0] ?? null);
    if (!candidate) {
      throw new Error("Could not parse destination suggestions from AI response");
    }

    // Helper to compute missing closing brackets/braces for truncated responses
    function computeMissingClosers(s: string): string {
      const stack: string[] = [];
      let inString = false;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '"' && s[i - 1] !== "\\") inString = !inString;
        if (inString) continue;
        if (ch === '{' || ch === '[') stack.push(ch);
        else if (ch === '}' || ch === ']') {
          const top = stack[stack.length - 1];
          if ((ch === '}' && top === '{') || (ch === ']' && top === '[')) stack.pop();
        }
      }
      let closers = '';
      while (stack.length) {
        const opener = stack.pop();
        if (opener === '{') closers += '}';
        else if (opener === '[') closers += ']';
      }
      return closers;
    }

    function tryParseAndValidate(s: string) {
      try {
        const parsed: Destination[] = JSON.parse(s);
        const valid = validateDestinations(parsed as any);
        return { parsed, valid };
      } catch (e) {
        return { parsed: null, valid: false };
      }
    }

    function sanitizeRepair(s: string) {
      const sanitized = sanitizeJsonTrailingCommas(s);
      const closers = computeMissingClosers(sanitized);
      return closers ? sanitized + closers : sanitized;
    }

    // Helper: filter, score preferences, check for empty result, and respond
    async function filterAndRespond(parsed: Destination[]): Promise<NextResponse> {
      const filtered = await correctAndFilterByTravelTime(parsed, input.homeCity, input.maxTravelHours);
      const retryResponse = await handleEmptyFilterResult(filtered, parsed.length, input);
      if (retryResponse) return retryResponse;

      // Score and sort by preference match
      const { matched, deprioritised } = scoreAndSortDestinations(
        filtered,
        input.likedActivities ?? [],
        input.dislikedActivities ?? [],
        input.preferHiddenGems ?? false
      );

      // If too few good matches, try re-prompting for replacements
      if (matched.length < 3 && deprioritised.length > 0) {
        const replacements = await handleLowPreferenceMatch(matched, deprioritised, input);
        if (replacements) return replacements;
      }

      // Return matched first, then deprioritised as fallback
      return destinationsResponse([...matched, ...deprioritised], cacheKey);
    }

    // 1) Try parsing the raw candidate
    let attemptCandidate = candidate;
    let result = tryParseAndValidate(attemptCandidate);
    if (result.parsed && result.valid) {
      return filterAndRespond(result.parsed);
    }

    // 2) Try sanitized/repair parse
    attemptCandidate = sanitizeRepair(candidate);
    result = tryParseAndValidate(attemptCandidate);
    if (result.parsed && result.valid) {
      return filterAndRespond(result.parsed);
    }

    // 3) Re-prompt loop: ask the model to correct the JSON up to 3 times
    let lastFixedRaw: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const extra = attempt > 0 ? `Attempt ${attempt + 1} of 3. Previous attempts failed validation. Only return the missing or corrected fields.` : undefined;
        lastFixedRaw = await requestJsonCorrection(attemptCandidate, validateDestinations.errors ?? [], "destinations", extra);
      } catch (e) {
        console.error('requestJsonCorrection error:', e);
        continue;
      }

      const extracted = extractJsonByFirstBracket(lastFixedRaw, "[") ?? (lastFixedRaw.match(/\[[\s\S]*\]/)?.[0] ?? null);
      if (!extracted) continue;
      attemptCandidate = sanitizeRepair(extracted);
      result = tryParseAndValidate(attemptCandidate);
      if (result.parsed && result.valid) {
        return filterAndRespond(result.parsed);
      }
      // otherwise loop and give the model more context (errors) next iteration
    }

    // 4) Fallback: try to parse the last candidate and auto-fill missing required fields
    const finalCandidate = attemptCandidate;
    try {
      const destinations: Destination[] = JSON.parse(finalCandidate);

      // Helper to generate a stable-ish ID
      function genId(i: number) {
        return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}-${i}`;
      }

      function defaultFlightHours(homeCity?: string, destCity?: string) {
        if (!homeCity || !destCity) return 5;
        if (homeCity.toLowerCase() === destCity.toLowerCase()) return 0;
        // Prefer the great-circle estimate from the coordinate table; fall back
        // to a safe intercontinental default when a city isn't recognised.
        return estimateFlightHours(homeCity, destCity) ?? 6;
      }

      // Auto-fill missing required fields with sensible defaults or derived values
      for (let i = 0; i < destinations.length; i++) {
        const d: any = destinations[i] as any;

        // Ensure id
        if (!d.id || String(d.id).trim() === "") d.id = genId(i);

        // Ensure country/city exist as strings (schema requires them)
        d.country = d.country ?? "";
        d.city = d.city ?? "";

        // Rationale
        if (!d.rationale || String(d.rationale).trim() === "") {
          d.rationale = `Suggested for ${d.city}${d.country ? ", " + d.country : ""} based on user preferences and budget.`;
        }

        // Highlights
        if (!Array.isArray(d.highlights) || d.highlights.length === 0) {
          d.highlights = d.city || d.country ? [`Top sights in ${d.city}${d.country ? ", " + d.country : ""}`] : ["Top sights"];
        }

        // estimatedFlightHours
        if (d.estimatedFlightHours === undefined || d.estimatedFlightHours === null || Number.isNaN(Number(d.estimatedFlightHours))) {
          d.estimatedFlightHours = defaultFlightHours(input.homeCity, d.city);
        } else {
          d.estimatedFlightHours = Number(d.estimatedFlightHours);
        }

        // estimatedBudgetFit
        const validBudgetFits = ["excellent", "good", "stretch"];
        if (!d.estimatedBudgetFit || !validBudgetFits.includes(String(d.estimatedBudgetFit))) {
          d.estimatedBudgetFit = "good";
        }

        // bestTimeToVisit
        if (!d.bestTimeToVisit || String(d.bestTimeToVisit).trim() === "") {
          d.bestTimeToVisit = "Any time";
        }

        // vibeMatch
        if (!Array.isArray(d.vibeMatch) || d.vibeMatch.length === 0) {
          d.vibeMatch = ["culture"];
        }

        // imageQuery
        if (!d.imageQuery || String(d.imageQuery).trim() === "") {
          const city = d.city ?? "";
          const country = d.country ?? "";
          d.imageQuery = `${city}${country ? ' ' + country : ''}`.trim();
        }

        // airportCode — keep if valid 3-letter code, otherwise leave undefined
        if (d.airportCode && !/^[A-Z]{3}$/.test(String(d.airportCode).toUpperCase())) {
          delete d.airportCode;
        } else if (d.airportCode) {
          d.airportCode = String(d.airportCode).toUpperCase();
        }
      }

      const valid = validateDestinations(destinations as any);
      if (valid) {
        return filterAndRespond(destinations);
      } else {
        console.error('Destination validation errors after fallback:', validateDestinations.errors);
        throw new Error(`Destinations JSON failed schema validation after repair/fallback: ${JSON.stringify(validateDestinations.errors)}`);
      }
    } catch (err3) {
      throw new Error(`Failed to parse destination JSON after repair and re-prompts: ${err3 instanceof Error ? err3.message : String(err3)}. Raw snippet: ${candidate.slice(0, 1000)}`);
    }
  } catch (error) {
    console.error("Error generating destinations:", error);
    const message = error instanceof Error ? error.message : "Failed to generate destinations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
