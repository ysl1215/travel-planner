import { NextRequest, NextResponse } from "next/server";
import Ajv from "ajv";
import itinerarySchema from "@/lib/schemas/itinerary.schema.json";
import { generate } from "@/lib/ai";
import { requestJsonCorrection } from "@/lib/aiFix";
import { buildItineraryPrompt, calculateTripDays } from "@/lib/prompts";
import {
  Attraction,
  FoodRecommendation,
  ItineraryActivity,
  ItineraryDay,
  RouteSegment,
  TripPlannerInput,
  TripItinerary,
} from "@/lib/types";

const ajv = new Ajv();
const validateItinerary = ajv.compile<TripItinerary>(itinerarySchema);

export async function POST(request: NextRequest) {
  try {
    const {
      destination,
      input,
      budgetSplit,
      expand = false,
      preferModel,
    }: {
      destination: string;
      input: TripPlannerInput;
      budgetSplit: {
        travel: number;
        accommodation: number;
        food: number;
        activities: number;
        misc: number;
      };
      expand?: boolean;
      preferModel?: string;
    } = await request.json();

    if (!destination || !input) {
      return NextResponse.json(
        { error: "Missing required fields: destination, input" },
        { status: 400 }
      );
    }

    const fullPrompt = buildItineraryPrompt(destination, input, budgetSplit);
    // Compute tripDays for a compact short prompt
    const tripDays = calculateTripDays(input.startDate, input.endDate);

    const shortPrompt = `You are an expert travel planner. Return a compact JSON object matching the itinerary schema only (no markdown or commentary). Destination: ${destination}. Duration: ${tripDays} days. Travelers: ${input.travelers}. Budget breakdown: travel ${budgetSplit.travel} ${input.currency}, accommodation ${budgetSplit.accommodation} ${input.currency}, food ${budgetSplit.food} ${input.currency}. Liked activities: ${input.likedActivities.join(", ") || "none"}. Travel style: ${input.travelStyle}. Keep output compact and include required fields.`;

    // Short-first behavior by default; caller may set expand=true to request a full, higher-token reply
    const promptToUse = expand ? fullPrompt : shortPrompt;
    const opts = expand ? undefined : { preferShortFirst: true };
    const raw = await generate(
      "You are an expert travel planner with deep local knowledge. Always respond with valid JSON only.",
      promptToUse,
      preferModel,
      opts
    );

    // Robust JSON extraction and parsing
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
      // Remove trailing commas before } or ]
      return s.replace(/,\s*(?=[}\]])/g, "");
    }

    function isRecord(value: unknown): value is Record<string, unknown> {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    }

    function toStringValue(value: unknown, fallback: string) {
      return typeof value === "string" && value.trim() ? value.trim() : fallback;
    }

    function toStringArray(value: unknown): string[] {
      if (!Array.isArray(value)) return [];
      return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
    }

    function inferBestTime(startDate: string, endDate: string) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Any time";
      const format = new Intl.DateTimeFormat("en", { month: "short" });
      const startLabel = format.format(start);
      const endLabel = format.format(end);
      return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
    }

    function toItineraryActivity(
      value: unknown,
      fallbackTime: string,
      fallbackLocation: string,
      fallbackType: ItineraryActivity["type"]
    ): ItineraryActivity {
      if (typeof value === "string") {
        return {
          time: fallbackTime,
          activity: value.trim(),
          location: fallbackLocation,
          duration: "2 hours",
          cost: "Free",
          tips: `Take it at an easy pace in ${fallbackLocation}.`,
          type: fallbackType,
        };
      }

      if (isRecord(value)) {
        return {
          time: toStringValue(value.time, fallbackTime),
          activity: toStringValue(value.activity, `Explore ${fallbackLocation}`),
          location: toStringValue(value.location, fallbackLocation),
          duration: toStringValue(value.duration, "2 hours"),
          cost: toStringValue(value.cost, "Free"),
          tips: value.tips === undefined ? undefined : toStringValue(value.tips, ""),
          waitTime: value.waitTime === undefined ? undefined : toStringValue(value.waitTime, ""),
          type: value.type === "attraction" || value.type === "food" || value.type === "transport" || value.type === "accommodation" || value.type === "activity"
            ? value.type
            : fallbackType,
        };
      }

      return {
        time: fallbackTime,
        activity: `Explore ${fallbackLocation}`,
        location: fallbackLocation,
        duration: "2 hours",
        cost: "Free",
        tips: `Keep this part of the day flexible in ${fallbackLocation}.`,
        type: fallbackType,
      };
    }

    function toActivityList(
      value: unknown,
      fallbackTexts: string[],
      fallbackLocation: string,
      fallbackType: ItineraryActivity["type"]
    ): ItineraryActivity[] {
      const items = Array.isArray(value) ? value : [];
      const normalized = items.map((item, index) =>
        toItineraryActivity(item, `${9 + index * 2}:00 AM`, fallbackLocation, fallbackType)
      );
      if (normalized.length > 0) return normalized;
      return fallbackTexts.map((text, index) =>
        toItineraryActivity(text, `${9 + index * 2}:00 AM`, fallbackLocation, fallbackType)
      );
    }

    function toAttraction(value: unknown, fallbackName: string, fallbackDescription: string): Attraction {
      if (isRecord(value)) {
        const type = value.type === "tourist" || value.type === "local" || value.type === "nature" || value.type === "food" || value.type === "culture"
          ? value.type
          : "culture";

        const cost = value.cost === "free" || value.cost === "cheap" || value.cost === "moderate" || value.cost === "expensive"
          ? value.cost
          : "moderate";

        return {
          name: toStringValue(value.name, fallbackName),
          type,
          description: toStringValue(value.description, fallbackDescription),
          estimatedDuration: toStringValue(value.estimatedDuration, "2-3 hours"),
          waitTime: value.waitTime === undefined ? undefined : toStringValue(value.waitTime, ""),
          tips: toStringValue(value.tips, `Visit early for the best experience in ${destination}.`),
          offBeatenPath: Boolean(value.offBeatenPath),
          cost,
        };
      }

      return {
        name: fallbackName,
        type: "culture",
        description: fallbackDescription,
        estimatedDuration: "2-3 hours",
        waitTime: undefined,
        tips: `Visit early for the best experience in ${destination}.`,
        offBeatenPath: false,
        cost: "moderate",
      };
    }

    function toFoodRecommendation(value: unknown, fallbackName: string, fallbackDescription: string): FoodRecommendation {
      if (isRecord(value)) {
        return {
          name: toStringValue(value.name, fallbackName),
          cuisine: toStringValue(value.cuisine, "Local cuisine"),
          description: toStringValue(value.description, fallbackDescription),
          priceRange: toStringValue(value.priceRange, "~$20 per person"),
          mustTry: toStringArray(value.mustTry).length > 0 ? toStringArray(value.mustTry) : ["local specialty"],
          touristTrap: Boolean(value.touristTrap),
          location: toStringValue(value.location, destination),
        };
      }

      return {
        name: fallbackName,
        cuisine: "Local cuisine",
        description: fallbackDescription,
        priceRange: "~$20 per person",
        mustTry: ["local specialty"],
        touristTrap: false,
        location: destination,
      };
    }

    function toRouteSegment(value: unknown, fallbackFrom: string, fallbackTo: string): RouteSegment {
      if (isRecord(value)) {
        return {
          from: toStringValue(value.from, fallbackFrom),
          to: toStringValue(value.to, fallbackTo),
          mode: toStringValue(value.mode, "walk"),
          duration: toStringValue(value.duration, "20 minutes"),
          cost: toStringValue(value.cost, "Free"),
          tips: value.tips === undefined ? undefined : toStringValue(value.tips, ""),
        };
      }

      return {
        from: fallbackFrom,
        to: fallbackTo,
        mode: "walk",
        duration: "20 minutes",
        cost: "Free",
        tips: `Use local transit or rideshares when moving around ${fallbackTo}.`,
      };
    }

    function buildFallbackItinerary(candidateValue: unknown): TripItinerary {
      const parsedCandidate = isRecord(candidateValue)
        ? candidateValue
        : (() => {
            if (typeof candidateValue !== "string") return {};
            try {
              const parsed = JSON.parse(candidateValue);
              return isRecord(parsed) ? parsed : {};
            } catch {
              return {};
            }
          })();

      const destinationCity = destination.split(",")[0]?.trim() || destination;
      const destinationLabel = destination;
      const totalDays = tripDays;
      const candidateDays = Array.isArray(parsedCandidate.days) ? parsedCandidate.days.filter(isRecord) : [];
      const candidateActivities = Array.isArray(parsedCandidate.activities) ? parsedCandidate.activities : [];
      const candidateTopAttractions = Array.isArray(parsedCandidate.topAttractions) ? parsedCandidate.topAttractions : [];
      const candidateFood = Array.isArray(parsedCandidate.foodRecommendations) ? parsedCandidate.foodRecommendations : [];
      const candidateRoute = Array.isArray(parsedCandidate.route) ? parsedCandidate.route : [];
      const practicalTips = toStringArray(parsedCandidate.practicalTips);

      const days: ItineraryDay[] = Array.from({ length: totalDays }, (_, index) => {
        const sourceDay = candidateDays[index];
        const dayActivities = index === 0 && candidateActivities.length > 0 ? candidateActivities : [];
        const morningFallback = dayActivities[0] ? [dayActivities[0] as string] : [`Start with a relaxed walk through ${destinationCity}`];
        const afternoonFallback = dayActivities[1] ? [dayActivities[1] as string] : [`Explore a key cultural site in ${destinationCity}`];
        const eveningFallback = dayActivities[2] ? [dayActivities[2] as string] : [`Enjoy local food and an easy evening in ${destinationCity}`];

        return {
          day: index + 1,
          date: sourceDay?.date && typeof sourceDay.date === "string" ? sourceDay.date : undefined,
          location: sourceDay?.location && typeof sourceDay.location === "string" ? sourceDay.location : destinationCity,
          theme: sourceDay?.theme && typeof sourceDay.theme === "string" ? sourceDay.theme : index === 0 ? `Introduction to ${destinationCity}` : `${destinationCity} highlights`,
          morning: toActivityList(sourceDay?.morning, morningFallback, destinationCity, "attraction"),
          afternoon: toActivityList(sourceDay?.afternoon, afternoonFallback, destinationCity, "activity"),
          evening: toActivityList(sourceDay?.evening, eveningFallback, destinationCity, "food"),
          travelNote: sourceDay?.travelNote && typeof sourceDay.travelNote === "string" ? sourceDay.travelNote : `Keep travel light and use central transport around ${destinationCity}.`,
          accommodation: sourceDay?.accommodation && typeof sourceDay.accommodation === "string" ? sourceDay.accommodation : `Stay in a central area of ${destinationCity}.`,
        };
      });

      const topAttractions =
        candidateTopAttractions.length > 0
          ? candidateTopAttractions.slice(0, 4).map((item, index) =>
              toAttraction(item, `${destinationCity} highlight ${index + 1}`, `A recommended stop in ${destinationCity}.`)
            )
          : [
              toAttraction(null, `${destinationCity} Old Town`, `Historic center and a great starting point for the trip.`),
              toAttraction(null, `${destinationCity} Local Market`, `A good place to sample local food and neighborhood life.`),
              toAttraction(null, `${destinationCity} Viewpoint`, `A scenic stop for city views and photos.`),
            ];

      const foodRecommendations =
        candidateFood.length > 0
          ? candidateFood.slice(0, 4).map((item, index) =>
              toFoodRecommendation(item, `${destinationCity} eatery ${index + 1}`, `A local food stop worth trying in ${destinationCity}.`)
            )
          : [
              toFoodRecommendation(null, `${destinationCity} Tavern`, `Classic local dishes with a relaxed atmosphere.`),
              toFoodRecommendation(null, `${destinationCity} Market Food`, `Street-food style bites and regional specialties.`),
              toFoodRecommendation(null, `${destinationCity} Cafe`, `Good for coffee, pastries, and an easy lunch.`),
            ];

      const route =
        candidateRoute.length > 0
          ? candidateRoute.slice(0, 4).map((item, index) =>
              toRouteSegment(item, index === 0 ? "Airport / station" : `Stop ${index}`, index === 0 ? destinationCity : `${destinationCity} area`)
            )
          : [];

      return {
        destination: destinationLabel,
        totalDays,
        overview: `A ${totalDays}-day ${input.travelStyle.toLowerCase()} trip to ${destinationLabel} with a focus on ${input.likedActivities.join(", ") || "local highlights"}.`,
        days,
        topAttractions,
        foodRecommendations,
        route,
        practicalTips:
          practicalTips.length > 0
            ? practicalTips.slice(0, 5)
            : [
                `Book major attractions early in ${destinationCity}.`,
                `Use public transit or walk when possible to save time and money.`,
                `Leave some room in the schedule for slower meals and neighborhood exploring.`,
              ],
        bestTimeToVisit: toStringValue(parsedCandidate.bestTimeToVisit, inferBestTime(input.startDate, input.endDate)),
      };
    }

    let candidate = extractJsonByFirstBracket(raw, "{") ?? (raw.match(/\{[\s\S]*\}/)?.[0] ?? null);
    if (!candidate) {
      // If no JSON found, attempt a model-assisted extraction (best-effort): ask the model to return ONLY the intended JSON
      try {
        const fixedRaw = await requestJsonCorrection(raw, [], 'itinerary', 'The previous response did not contain JSON. Please return the corrected JSON object only that matches the itinerary schema.');
        candidate = extractJsonByFirstBracket(fixedRaw, "{") ?? (fixedRaw.match(/\{[\s\S]*\}/)?.[0] ?? null);
      } catch {
        // Fall through to final error
      }
      if (!candidate) {
        throw new Error("Could not parse itinerary from AI response");
      }
    }

    try {
      const itinerary: unknown = JSON.parse(candidate);
      const valid = validateItinerary(itinerary);
      if (!valid) {
        console.error('Itinerary validation errors:', validateItinerary.errors);
        throw new Error(`Itinerary JSON failed schema validation: ${JSON.stringify(validateItinerary.errors)}`);
      }
      return NextResponse.json({ itinerary });
    } catch {
      const sanitized = sanitizeJsonTrailingCommas(candidate);
      try {
        const itinerary: unknown = JSON.parse(sanitized);
        const valid = validateItinerary(itinerary);
        if (!valid) {
          console.error('Itinerary validation errors:', validateItinerary.errors);
          throw new Error(`Itinerary JSON failed schema validation: ${JSON.stringify(validateItinerary.errors)}`);
        }
        return NextResponse.json({ itinerary });
      } catch {
        // Attempt to auto-close any unbalanced open brackets/braces (best-effort repair for truncated responses)
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

        const closers = computeMissingClosers(sanitized);
        if (closers) {
          const repaired = sanitized + closers;
          try {
            const itinerary: unknown = JSON.parse(repaired);
            const valid = validateItinerary(itinerary);
            if (valid) {
              return NextResponse.json({ itinerary });
            }
            // fall through to re-prompt step
           } catch {
             // fall through to re-prompt step
            }
        }

        // Attempt to ask the model to fix the JSON (re-prompt) once
        try {
          const fixPrompt = `The JSON below failed validation for an itinerary. Validation errors: ${JSON.stringify(validateItinerary.errors || [])}\n\nOriginal JSON: ${sanitized}\n\nPlease return a corrected JSON object only that conforms to the itinerary schema. The object MUST include destination, totalDays, overview, days, topAttractions, foodRecommendations, route, practicalTips, and bestTimeToVisit. Do not return a simplified object with only date or activities. Output ONLY the JSON object.`;
          const fixedRaw = await requestJsonCorrection(sanitized, validateItinerary.errors || [], 'itinerary', fixPrompt);
          const fixedCandidate = extractJsonByFirstBracket(fixedRaw, '{') ?? (fixedRaw.match(/\{[\s\S]*\}/)?.[0] ?? null);
          if (!fixedCandidate) throw new Error('Model did not return JSON');
          const sanitized2 = sanitizeJsonTrailingCommas(fixedCandidate);
          const closers2 = computeMissingClosers(sanitized2);
          const repaired2 = closers2 ? sanitized2 + closers2 : sanitized2;
          const itinerary: unknown = JSON.parse(repaired2);
          const valid2 = validateItinerary(itinerary);
          if (valid2) {
            return NextResponse.json({ itinerary });
          }

          console.warn('Itinerary validation errors after re-prompt:', validateItinerary.errors);
          const fallbackItinerary = buildFallbackItinerary(itinerary);
          const fallbackValid = validateItinerary(fallbackItinerary);
          if (fallbackValid) {
            console.warn('Using normalized fallback itinerary after schema mismatch.');
            return NextResponse.json({ itinerary: fallbackItinerary });
          }

          throw new Error(`Itinerary JSON failed schema validation after re-prompt: ${JSON.stringify(validateItinerary.errors)}`);
        } catch (finalErr) {
          const fallbackItinerary = buildFallbackItinerary(candidate);
          const fallbackValid = validateItinerary(fallbackItinerary);
          if (fallbackValid) {
            console.warn(`Falling back to normalized itinerary after repair/re-prompt failure: ${finalErr instanceof Error ? finalErr.message : String(finalErr)}`);
            return NextResponse.json({ itinerary: fallbackItinerary });
          }
          throw new Error(`Failed to parse itinerary JSON after repair and re-prompt: ${finalErr instanceof Error ? finalErr.message : String(finalErr)}. Raw snippet: ${candidate.slice(0, 1000)}`);
        }
      }
    }
  } catch (error) {
    console.error("Error generating itinerary:", error);
    const message = error instanceof Error ? error.message : "Failed to generate itinerary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
