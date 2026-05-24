import { Destination } from "./types";

const ACTIVITY_KEYWORDS: Record<string, string[]> = {
  "Beach & Swimming": ["beach", "snorkeling", "surfing", "diving", "seaside", "coast", "coastal", "ocean", "reef", "island"],
  "Hiking & Trekking": ["hiking", "trekking", "trails", "mountains", "summit", "trek", "hike", "alpine", "canyon", "gorge"],
  "Cultural Sites": ["temple", "heritage", "historical", "ruins", "ancient", "cultural", "monument", "shrine", "palace", "castle"],
  "Museums": ["museum", "gallery", "exhibit", "art museum", "collection"],
  "Food & Culinary": ["food", "culinary", "gastronomy", "street food", "cuisine", "restaurant", "foodie", "cooking", "market food"],
  "Nightlife": ["nightlife", "clubbing", "bars", "party", "pub crawl", "nightclub", "clubs", "bar scene", "drinking"],
  "Shopping": ["shopping", "markets", "boutiques", "bazaar", "mall", "outlet"],
  "Adventure Sports": ["adventure", "bungee", "paragliding", "rafting", "skydiving", "zip line", "canyoning", "extreme"],
  "Wildlife & Nature": ["wildlife", "safari", "nature", "national park", "birdwatching", "jungle", "forest", "eco"],
  "History": ["history", "historic", "medieval", "colonial", "archaeological", "world war", "dynasty", "empire"],
  "Art & Architecture": ["art", "architecture", "gothic", "baroque", "renaissance", "modernist", "design", "mural"],
  "Wellness & Spa": ["wellness", "spa", "yoga", "meditation", "thermal", "hot springs", "retreat", "relaxation"],
  "Photography": ["photography", "photogenic", "scenic", "panoramic", "viewpoint", "instagram"],
  "Local Markets": ["local market", "flea market", "night market", "bazaar", "artisan", "craft market", "street market"],
  "Water Sports": ["water sports", "kayaking", "paddleboarding", "sailing", "windsurfing", "jet ski", "snorkel"],
  "Skiing & Snow": ["skiing", "snowboarding", "ski resort", "snow", "winter sports", "slopes", "après-ski"],
};

const GENERIC_TOURIST_CITIES = new Set([
  "paris", "london", "rome", "new york", "tokyo", "barcelona",
  "amsterdam", "dubai", "bangkok", "singapore", "sydney",
  "los angeles", "san francisco", "venice", "florence",
  "prague", "vienna", "berlin", "madrid", "lisbon",
  "hong kong", "istanbul", "cairo", "rio de janeiro",
]);

interface PreferenceScore {
  score: number;
  matchedLikes: string[];
  matchedDislikes: string[];
  genericPenalty: boolean;
}

function getSearchableText(destination: Destination): string {
  const parts = [
    ...(destination.vibeMatch || []),
    ...(destination.highlights || []),
    destination.rationale || "",
  ];
  return parts.join(" ").toLowerCase();
}

function findKeywordMatches(text: string, activityName: string): string[] {
  const keywords = ACTIVITY_KEYWORDS[activityName];
  if (!keywords) return [];
  return keywords.filter((kw) => text.includes(kw));
}

export function scoreDestination(
  destination: Destination,
  likedActivities: string[],
  dislikedActivities: string[],
  preferHiddenGems: boolean
): PreferenceScore {
  const text = getSearchableText(destination);
  let score = 0;
  const matchedLikes: string[] = [];
  const matchedDislikes: string[] = [];

  for (const liked of likedActivities) {
    const matches = findKeywordMatches(text, liked);
    if (matches.length > 0) {
      score += Math.min(matches.length * 0.3, 0.6);
      matchedLikes.push(liked);
    }
  }

  for (const disliked of dislikedActivities) {
    const matches = findKeywordMatches(text, disliked);
    if (matches.length > 0) {
      score -= Math.min(matches.length * 0.5, 1.0);
      matchedDislikes.push(disliked);
    }
  }

  let genericPenalty = false;
  if (preferHiddenGems && GENERIC_TOURIST_CITIES.has(destination.city.toLowerCase().trim())) {
    score -= 0.3;
    genericPenalty = true;
  }

  score = Math.max(-1, Math.min(1, score));

  return { score, matchedLikes, matchedDislikes, genericPenalty };
}

export interface ScoredDestination extends Destination {
  _preferenceScore: number;
}

export function scoreAndSortDestinations(
  destinations: Destination[],
  likedActivities: string[],
  dislikedActivities: string[],
  preferHiddenGems: boolean
): { matched: Destination[]; deprioritised: Destination[] } {
  const scored: { dest: Destination; result: PreferenceScore }[] = destinations.map((dest) => ({
    dest,
    result: scoreDestination(dest, likedActivities, dislikedActivities, preferHiddenGems),
  }));

  scored.sort((a, b) => b.result.score - a.result.score);

  const matched: Destination[] = [];
  const deprioritised: Destination[] = [];

  for (const { dest, result } of scored) {
    if (result.score > 0) {
      matched.push(dest);
    } else {
      const warning = buildWarning(result);
      deprioritised.push({ ...dest, preferenceWarning: warning });
    }
  }

  return { matched, deprioritised };
}

function buildWarning(result: PreferenceScore): string {
  const reasons: string[] = [];
  if (result.matchedDislikes.length > 0) {
    reasons.push(`matches avoided activities: ${result.matchedDislikes.join(", ")}`);
  }
  if (result.genericPenalty) {
    reasons.push("popular tourist destination");
  }
  if (reasons.length === 0) {
    reasons.push("low match with your stated preferences");
  }
  return reasons.join("; ");
}
