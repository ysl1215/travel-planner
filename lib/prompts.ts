import { TripPlannerInput } from "./types";

export function buildDestinationPrompt(input: TripPlannerInput): string {
  return `You are an expert travel planner. Based on the following user preferences, suggest 4-6 destinations that would be a great fit.

User Preferences:
- Total Budget: ${input.budget} ${input.currency} for ${input.travelers} traveler(s)
- Home City: ${input.homeCity}
- Travel Dates: ${input.startDate} to ${input.endDate} (flexible by ±${input.flexDays} days)
- Number of Travelers: ${input.travelers}
- Activities they love: ${input.likedActivities.join(", ") || "not specified"}
- Activities to avoid: ${input.dislikedActivities.join(", ") || "none"}
- Preferred travel mode: ${input.travelMode.join(", ") || "any"}
- Travel style: ${input.travelStyle}
- Max travel time from home: ${input.maxTravelHours ? `${input.maxTravelHours} hours` : "flexible"}
${input.country ? `- Preferred country/region: ${input.country}` : ""}

Important considerations:
- Budget MUST cover flights/transport AND accommodation at minimum
- Consider value-for-money destinations
- Consider seasonality and best times to visit
- Rough dates allow flexibility to find better prices

Respond with a JSON array of destinations in this exact format:
[
  {
    "id": "unique-id",
    "country": "Country Name",
    "city": "City Name",
    "region": "Region/Area (optional)",
    "rationale": "Detailed 2-3 sentence explanation of why this fits the user's budget, preferences, and dates",
    "highlights": ["highlight1", "highlight2", "highlight3"],
    "estimatedFlightHours": 8,
    "estimatedBudgetFit": "excellent|good|stretch",
    "bestTimeToVisit": "Month range",
    "vibeMatch": ["adventure", "culture", "relaxation"],
    "imageQuery": "search query for destination image"
  }
]

Only respond with the JSON array, no other text.`;
}

export function buildItineraryPrompt(
  destination: string,
  input: TripPlannerInput,
  budgetSplit: { travel: number; accommodation: number; food: number; activities: number; misc: number }
): string {
  const tripDays = Math.ceil(
    (new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  return `You are an expert travel planner with deep local knowledge. Create a detailed, day-by-day itinerary for:

Destination: ${destination}
Duration: ${tripDays} days
Travelers: ${input.travelers}
Budget Breakdown:
  - Transport/Travel: ${budgetSplit.travel} ${input.currency}
  - Accommodation: ${budgetSplit.accommodation} ${input.currency}
  - Food: ${budgetSplit.food} ${input.currency}
  - Activities: ${budgetSplit.activities} ${input.currency}
  - Miscellaneous: ${budgetSplit.misc} ${input.currency}
Liked Activities: ${input.likedActivities.join(", ") || "general tourism"}
Activities to avoid: ${input.dislikedActivities.join(", ") || "none"}
Travel Style: ${input.travelStyle}

Create a response with:
1. A mix of top tourist attractions AND hidden gems / local experiences
2. Include realistic wait times for popular attractions where known
3. Food recommendations that AVOID tourist traps
4. Optimal routing to minimize unnecessary travel
5. Practical tips for each day

Respond with JSON in this exact format:
{
  "destination": "City, Country",
  "totalDays": ${tripDays},
  "overview": "Brief overview of the trip",
  "days": [
    {
      "day": 1,
      "location": "City/Area",
      "theme": "Theme for the day",
      "morning": [
        {
          "time": "9:00 AM",
          "activity": "Activity name",
          "location": "Specific location",
          "duration": "2 hours",
          "cost": "Free / ~$10",
          "tips": "Practical tip",
          "type": "attraction|food|transport|accommodation|activity"
        }
      ],
      "afternoon": [],
      "evening": [],
      "travelNote": "Any travel notes for the day",
      "accommodation": "Recommended area/type to stay"
    }
  ],
  "topAttractions": [
    {
      "name": "Attraction name",
      "type": "tourist|local|nature|food|culture",
      "description": "Brief description",
      "estimatedDuration": "2-3 hours",
      "waitTime": "30-60 min on weekends",
      "tips": "Best time to visit, how to skip lines, etc.",
      "offBeatenPath": false,
      "cost": "free|cheap|moderate|expensive"
    }
  ],
  "foodRecommendations": [
    {
      "name": "Restaurant/Food spot name",
      "cuisine": "Type of cuisine",
      "description": "What makes it special",
      "priceRange": "$10-15 per person",
      "mustTry": ["dish1", "dish2"],
      "touristTrap": false,
      "location": "Neighborhood/area"
    }
  ],
  "route": [
    {
      "from": "Location A",
      "to": "Location B",
      "mode": "subway/bus/walk",
      "duration": "20 minutes",
      "cost": "$2",
      "tips": "Take Line 3"
    }
  ],
  "practicalTips": ["tip1", "tip2"],
  "bestTimeToVisit": "Specific months and why"
}

Only respond with the JSON, no other text.`;
}

export function buildChatSystemPrompt(
  tripContext: TripPlannerInput | null,
  destination?: string
): string {
  let context = "";
  if (tripContext) {
    context = `
Current Trip Planning Context:
- Budget: ${tripContext.budget} ${tripContext.currency} for ${tripContext.travelers} traveler(s)
- From: ${tripContext.homeCity}
- Dates: ${tripContext.startDate} to ${tripContext.endDate}
- Liked activities: ${tripContext.likedActivities.join(", ")}
- Travel style: ${tripContext.travelStyle}
${destination ? `- Currently viewing: ${destination}` : ""}
`;
  }

  return `You are a knowledgeable and friendly travel planning assistant. You help users plan amazing trips with practical, actionable advice.

${context}

Your expertise includes:
- Destination recommendations and insider tips
- Budget optimization and cost-saving strategies
- Local customs, etiquette, and cultural insights
- Visa requirements and travel logistics
- Hidden gems and off-the-beaten-path experiences
- Food culture and restaurant recommendations
- Safety tips and travel advisories
- Best times to visit various destinations
- Transportation options and route optimization

Always be specific, practical, and budget-conscious. When recommending places, include why they're special and any tips to enhance the experience. If asked about visa or safety, always recommend checking official government travel advisories.`;
}
