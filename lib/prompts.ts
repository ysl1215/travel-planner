import { TripPlannerInput } from "./types";
import { sanitize, sanitizeArray } from "./sanitize";
import { estimateFlightHours } from "./flightTime";

/**
 * Single source of truth for the destination JSON shape the model must return. Referenced
 * by the main suggest prompt and both re-prompts (previously hardcoded verbatim in 3 places)
 * so the schema can't drift between them.
 */
export const DESTINATION_SCHEMA_EXAMPLE =
  `{"id":"string","country":"string","city":"string","airportCode":"3-letter IATA","rationale":"string","highlights":["..."],"estimatedFlightHours":0.0,"estimatedBudgetFit":"excellent|good|stretch","bestTimeToVisit":"string","vibeMatch":["..."],"imageQuery":"string"}`;

function buildFlightTimeExamples(homeCity: string, maxHours?: number): string {
  const references = [
    "tokyo", "seoul", "bangkok", "singapore", "dubai",
    "london", "paris", "sydney", "new york", "mumbai",
  ];
  const examples: string[] = [];
  const cutoff = maxHours ? maxHours * 2.5 : Infinity;
  for (const city of references) {
    const hours = estimateFlightHours(homeCity, city);
    if (hours === null) continue;
    // Skip references that are vastly beyond the constraint (saves tokens)
    if (hours > cutoff) continue;
    const mark = maxHours && hours > maxHours ? " ✗ TOO FAR" : " ✓";
    examples.push(`  ${city}: ~${hours}h${mark}`);
  }
  if (examples.length === 0) return "";
  return `\nREFERENCE flight times from ${homeCity} (use these as calibration — do NOT suggest cities marked ✗ TOO FAR):\n${examples.join("\n")}`;
}

export function buildDestinationPrompt(input: TripPlannerInput): string {
  const maxHours = input.maxTravelHours;
  const hasMaxTravel = maxHours && maxHours > 0;

  const travelConstraint = hasMaxTravel
    ? `HARD CONSTRAINT — max ${maxHours}h direct flight from ${input.homeCity}. estimatedFlightHours MUST reflect real non-stop duration. If fewer than 4 cities fit, return only those that fit — do NOT fabricate shorter times.`
    : `Max travel time: flexible`;

  const flightExamples = hasMaxTravel ? buildFlightTimeExamples(input.homeCity, maxHours) : "";

  return `Suggest 4-6 travel destinations for this user. Respond with a JSON array only — no markdown, no commentary.

USER'S PRIORITIES (highest weight — this is what they care about most):
${sanitize(input.travelPriorities, 1000)}
${input.pastTrips ? `\nCALIBRATION (trips they loved/hated — match the "loved" vibe, avoid the "hated" vibe):\n${sanitize(input.pastTrips, 500)}` : ""}

User profile:
- Home: ${sanitize(input.homeCity)}
- Budget: ${input.budget} ${input.currency} for ${input.travelers} traveler(s)
- Dates: ${input.startDate} to ${input.endDate} (±${input.flexDays} days flex)
- Likes: ${sanitizeArray(input.likedActivities).join(", ") || "not specified"}
- Avoids: ${sanitizeArray(input.dislikedActivities).join(", ") || "none"}
- Style: ${sanitize(input.travelStyle)}
- ${travelConstraint}
${input.country ? `- Preferred region: ${sanitize(input.country)}` : ""}
${input.preferHiddenGems ? `- STRONG PREFERENCE: off-the-beaten-path destinations.` : ""}${flightExamples}

HARD RULES:
- Do NOT suggest ANY destination whose primary appeal is one of the 'Avoids' activities above. If the user avoids Nightlife, do not suggest party destinations (Ibiza, Koh Phangan, Berlin clubs, etc.). If they avoid Beach, do not suggest beach resorts.
- The vibeMatch array MUST contain activities from the user's 'Likes' list. If none of the user's liked activities fit a destination, do not suggest it.
- Do NOT suggest destinations that appear in the top 10 results of a generic "best places to visit" Google search.
- Prioritise places a well-travelled local would recommend to a friend, not a tourist.
- The rationale MUST reference the user's specific priorities above — not generic "beautiful scenery" or "rich culture".

Return a compact JSON array. Each item (rationale = 2-3 sentences referencing user priorities):
${DESTINATION_SCHEMA_EXAMPLE}`;
}

export function buildItineraryPrompt(
  destination: string,
  input: TripPlannerInput,
  budgetSplit: { travel: number; accommodation: number; food: number; activities: number; misc: number },
  attractionContext?: string
): string {
  const tripDays = Math.ceil(
    (new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  const contextBlock = attractionContext
    ? `\n\nLOCAL KNOWLEDGE BASE (use these real durations and tips — do NOT ignore them):\n${attractionContext}\n`
    : "";

  return `Create a ${tripDays}-day itinerary for ${sanitize(destination)}. ${input.travelers} traveler(s). Style: ${sanitize(input.travelStyle)}. Likes: ${sanitizeArray(input.likedActivities).join(", ") || "general tourism"}. Avoids: ${sanitizeArray(input.dislikedActivities).join(", ") || "none"}.${input.preferHiddenGems ? " PRIORITY: off-the-beaten-path experiences, local hidden gems, avoid tourist traps." : ""}
Budget: travel ${budgetSplit.travel}, accommodation ${budgetSplit.accommodation}, food ${budgetSplit.food}, activities ${budgetSplit.activities}, misc ${budgetSplit.misc} (${input.currency}).
${input.travelPriorities ? `\nUSER PRIORITIES (shape the entire itinerary around this): ${sanitize(input.travelPriorities, 500)}` : ""}${input.pastTrips ? `\nCALIBRATION: ${sanitize(input.pastTrips, 300)}` : ""}${contextBlock}

Return a single compact JSON object only — no markdown, no commentary. Schema (all string fields free-text; enums shown with |; arrays may repeat their element):
{"destination":"City, Country","totalDays":${tripDays},"overview":str,"days":[{"day":int,"location":str,"theme":str,"morning":[{"time":str,"activity":str,"location":str,"duration":str,"cost":str,"tips":str,"type":"attraction|food|transport|accommodation|activity"}],"afternoon":[…same],"evening":[…same],"travelNote":str,"accommodation":str}],"clusters":[{"cluster":str,"attractions":[str],"options":[{"label":str,"attractions":[str],"hours":num,"tradeoff":str}],"recommendation":str,"recommendation_reason":str}],"topAttractions":[{"name":str,"type":"tourist|local|nature|food|culture","description":str,"estimatedDuration":str,"waitTime":str,"tips":str,"offBeatenPath":bool,"cost":"free|cheap|moderate|expensive"}],"foodRecommendations":[{"name":str,"cuisine":str,"description":str,"priceRange":str,"mustTry":[str],"touristTrap":bool,"location":str}],"route":[{"from":str,"to":str,"mode":str,"duration":str,"cost":str,"tips":str}],"practicalTips":[str],"bestTimeToVisit":str}

Rules:
- clusters: only include when 2+ attractions share a geographic area (e.g. multiple lakes, trails, or neighbourhoods within 30-60 min of each other). Each cluster must have 2-3 options with realistic hours and honest tradeoffs. Omit clusters array if no such groupings exist.
- Include mix of tourist attractions and hidden gems. Avoid tourist-trap food spots. Minimize unnecessary travel in routing.
- When duration data is provided above, use it — do not substitute generic "2 hours" estimates.
- Prioritise places a local would recommend to a friend. Avoid anything that feels like a generic tourist checklist.
- The itinerary MUST reflect the user's stated priorities — not a generic "Day 1: explore the old town" template.`;
}

export function buildChatSystemPrompt(
  tripContext: TripPlannerInput | null,
  destination?: string
): string {
  const context = tripContext
    ? `Trip context: ${tripContext.budget} ${tripContext.currency} for ${tripContext.travelers} from ${sanitize(tripContext.homeCity)}, ${tripContext.startDate}–${tripContext.endDate}, style: ${sanitize(tripContext.travelStyle)}, likes: ${sanitizeArray(tripContext.likedActivities).join(", ")}${destination ? `, viewing: ${sanitize(destination)}` : ""}.`
    : "";

  return `You are a practical travel planning assistant. Give specific, budget-conscious advice with local tips. For visa/safety questions, recommend checking official government advisories. ${context}`;
}
