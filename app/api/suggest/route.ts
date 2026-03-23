import { NextRequest, NextResponse } from "next/server";
import Ajv from "ajv";
import destinationsSchema from "@/lib/schemas/destinations.schema.json";
import { generate } from "@/lib/ai";
import { requestJsonCorrection } from "@/lib/aiFix";
import {
  extractCandidateItems,
  extractJsonCandidate,
  sanitizeRepair,
} from "@/lib/jsonExtraction";
import { buildDestinationPrompt } from "@/lib/prompts";
import { cityToAirport } from "@/lib/airports";
import { lookupFlightHours } from "@/lib/flightPrices";
import { resolveDestinationTravelTime } from "@/lib/travelTime";
import { getTravelHint } from "@/lib/travelHints";
import { buildBucketAwareDestinationCandidates } from "@/lib/destinationFallbacks";
import { TripPlannerInput, Destination } from "@/lib/types";

const ajv = new Ajv();
const validateDestinations = ajv.compile<Destination[]>(destinationsSchema);

type CachedSuggestion = {
  destinations: Destination[];
  expiresAt: number;
};

const SUGGESTION_CACHE_TTL_MS = Number(process.env.SUGGESTION_CACHE_TTL_MS ?? String(30 * 60 * 1000));

declare global {
  var __suggestionCache: Map<string, CachedSuggestion> | undefined;
}

const suggestionCache = globalThis.__suggestionCache ?? new Map<string, CachedSuggestion>();
globalThis.__suggestionCache = suggestionCache;

function buildSuggestionCacheKey(input: TripPlannerInput) {
  const normalizeStrings = (values: string[] | undefined) =>
    (values ?? [])
      .map((value) => value.trim())
      .filter(Boolean)
      .sort();

  return JSON.stringify({
    budget: input.budget,
    currency: input.currency,
    homeCity: input.homeCity.trim().toLowerCase(),
    startDate: input.startDate,
    endDate: input.endDate,
    flexDays: input.flexDays,
    travelers: input.travelers,
    likedActivities: normalizeStrings(input.likedActivities),
    dislikedActivities: normalizeStrings(input.dislikedActivities),
    travelMode: normalizeStrings(input.travelMode),
    country: input.country?.trim().toLowerCase() ?? "",
    maxTravelHours: input.maxTravelHours ?? null,
    checkLiveFlightPrices: input.checkLiveFlightPrices !== false,
    travelStyle: input.travelStyle.trim().toLowerCase(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const input: TripPlannerInput = await request.json();

    if (!input.budget || !input.homeCity || !input.travelers) {
      return NextResponse.json(
        { error: "Missing required fields: budget, homeCity, travelers" },
        { status: 400 }
      );
    }

    const originAirport = cityToAirport(input.homeCity);
    const hasTravelLimit =
      typeof input.maxTravelHours === "number" && Number.isFinite(input.maxTravelHours) && input.maxTravelHours > 0;
    const shouldCheckLiveFlightPrices = input.checkLiveFlightPrices !== false;
    const travelHint = getTravelHint(input.homeCity, input.maxTravelHours);
    const suggestionCacheKey = buildSuggestionCacheKey(input);
    const cachedSuggestion = suggestionCache.get(suggestionCacheKey);
    if (cachedSuggestion && cachedSuggestion.expiresAt > Date.now()) {
      return NextResponse.json({ destinations: cachedSuggestion.destinations });
    }
    if (cachedSuggestion) {
      suggestionCache.delete(suggestionCacheKey);
    }

    const respondWithDestinations = (destinations: Destination[]) => {
      suggestionCache.set(suggestionCacheKey, {
        destinations,
        expiresAt: Date.now() + SUGGESTION_CACHE_TTL_MS,
      });
      return NextResponse.json({ destinations });
    };

    const prompt = buildDestinationPrompt(input, originAirport, travelHint);
    const raw = await generate(
      "You are an expert travel planner. Always respond with valid JSON only.",
      prompt,
      undefined,
      { temperature: 0.2 }
    );

    function buildRetryPrompt(basePrompt: string) {
      if (!hasTravelLimit || !travelHint) return basePrompt;

      return `${basePrompt}\n\nThis is a retry because the previous suggestions were too broad for the user's home city and travel limit. Focus only on the nearby bucket above, and return destinations that fit the time constraint without drifting into faraway continents.`;
    }

    function parseDestinationResponse(text: string, minCount = 8): Destination[] | null {
      const candidateText = extractJsonCandidate(text);
      if (!candidateText) return null;

      try {
        const parsed = JSON.parse(sanitizeRepair(candidateText));
        return buildBucketAwareDestinationCandidates(extractCandidateItems(parsed), travelHint, minCount);
      } catch {
        return null;
      }
    }

    function sortDestinations(destinations: Destination[]): Destination[] {
      const budgetFitScore: Record<Destination["estimatedBudgetFit"], number> = {
        excellent: 0,
        good: 1,
        stretch: 2,
      };

      return [...destinations].sort((a, b) => {
        if (a.estimatedFlightHours !== b.estimatedFlightHours) {
          return a.estimatedFlightHours - b.estimatedFlightHours;
        }

        if (budgetFitScore[a.estimatedBudgetFit] !== budgetFitScore[b.estimatedBudgetFit]) {
          return budgetFitScore[a.estimatedBudgetFit] - budgetFitScore[b.estimatedBudgetFit];
        }

        const cityComparison = a.city.localeCompare(b.city);
        if (cityComparison !== 0) return cityComparison;

        return a.country.localeCompare(b.country);
      });
    }

    async function applyTravelTimeConstraint(destinations: Destination[]): Promise<Destination[]> {
      if (!hasTravelLimit) return destinations;

      if (!originAirport || !shouldCheckLiveFlightPrices) {
        return sortDestinations(
          destinations.filter(
            (entry) => entry.estimatedFlightHours <= (input.maxTravelHours ?? Number.POSITIVE_INFINITY)
          )
        );
      }

      const scored = await Promise.all(
        destinations.map(async (destination) => {
          const destAirport = cityToAirport(destination.city);
          if (!destAirport) {
            return resolveDestinationTravelTime(destination, {
              hours: null,
              verifiedThroughLiveSearch: false,
              fromCache: false,
            }, {
              hasTravelLimit,
              shouldCheckLiveFlightPrices,
              canVerifyLiveFlightHours: false,
            });
          }

          const actualHours = await lookupFlightHours({
            origin: originAirport,
            destination: destAirport,
            departure: input.startDate,
            returnDate: input.endDate || undefined,
            adults: input.travelers,
            seat: "economy",
            currency: input.currency,
          });

          return resolveDestinationTravelTime(destination, actualHours, {
            hasTravelLimit,
            shouldCheckLiveFlightPrices,
            canVerifyLiveFlightHours: Boolean(destAirport),
          });
        })
      );

      return sortDestinations(
        scored
          .filter((entry) => entry.hours <= (input.maxTravelHours ?? Number.POSITIVE_INFINITY))
          .map((entry) => entry.destination)
      );
    }

    // Helper to compute missing closing brackets/braces for truncated responses
    const directParsed = parseDestinationResponse(raw, 8);
    if (directParsed && validateDestinations(directParsed)) {
      const constrained = await applyTravelTimeConstraint(directParsed);
      if (!hasTravelLimit || constrained.length > 0) {
        return respondWithDestinations(
          constrained.length > 0 ? constrained : sortDestinations(directParsed)
        );
      }
    }

    if (hasTravelLimit) {
      const hardConstraint = buildRetryPrompt(
        `${prompt}\n\nHard constraint: only suggest destinations with a realistic flight time of ${input.maxTravelHours} hours or less from ${input.homeCity}${originAirport ? ` (${originAirport})` : ""}. Exclude any destination that is farther away.`
      );
      try {
        const constrainedRaw = await generate(
          "You are an expert travel planner. Always respond with valid JSON only.",
          hardConstraint,
          undefined,
          { temperature: 0.2 }
        );
        const constrainedParsed = parseDestinationResponse(constrainedRaw, 8);
        if (constrainedParsed && validateDestinations(constrainedParsed)) {
          const constrained = await applyTravelTimeConstraint(constrainedParsed);
          if (constrained.length > 0) {
            return respondWithDestinations(constrained);
          }
        }
      } catch {
        console.error("Constrained destination generation failed");
      }
    }

    // Re-prompt loop: ask the model to correct the JSON up to 3 times
    for (let attempt = 0; attempt < 3; attempt++) {
      const extra =
        attempt > 0
          ? `Attempt ${attempt + 1} of 3. Previous attempts failed validation. Only return the missing or corrected fields.`
          : undefined;

      try {
        const fixedRaw = await requestJsonCorrection(raw, validateDestinations.errors ?? [], "destinations", extra);
        const fixedParsed = parseDestinationResponse(fixedRaw, 8);
        if (fixedParsed && validateDestinations(fixedParsed)) {
          const constrained = await applyTravelTimeConstraint(fixedParsed);
          if (!hasTravelLimit || constrained.length > 0) {
            return respondWithDestinations(constrained.length > 0 ? constrained : fixedParsed);
          }
        }
      } catch {
        console.error("requestJsonCorrection error");
      }
    }

    const fallbackDestinations = sortDestinations(
      buildBucketAwareDestinationCandidates([], travelHint, 8)
    );
    if (validateDestinations(fallbackDestinations)) {
      console.warn("Using fallback destination suggestions after parse/re-prompt failure.");
      const allowFallbackUnderLimit = process.env.SUGGEST_ALLOW_FALLBACK_UNDER_LIMIT !== "false";
      if (!hasTravelLimit || allowFallbackUnderLimit) {
        const annotated = fallbackDestinations.map((d) => ({ ...d, verifiedThroughLiveSearch: false }));
        return respondWithDestinations(annotated);
      } else {
        throw new Error(
          `No destinations found within ${input.maxTravelHours} hours from ${input.homeCity}. Try increasing the travel time limit.`
        );
      }
    }

    throw new Error(`Failed to parse destination suggestions from AI response. Raw snippet: ${raw.slice(0, 1000)}`);
  } catch (error) {
    console.error("Error generating destinations:", error);
    const message = error instanceof Error ? error.message : "Failed to generate destinations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
