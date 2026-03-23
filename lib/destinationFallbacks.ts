import { Destination } from "./types";
import { TravelHint, destinationMatchesTravelHint } from "./travelHints";

function createFallbackDestination(destination: Destination): Destination {
  return {
    ...destination,
    verifiedThroughLiveSearch: false,
  };
}

const createPool = (destinations: Destination[]) => destinations.map(createFallbackDestination);

const EAST_ASIA_FALLBACKS = createPool([
  {
    id: "east-asia-tokyo",
    country: "Japan",
    city: "Tokyo",
    region: "Kanto",
    rationale: "Tokyo is a fast-reach East Asia option with excellent food, culture, and efficient transport.",
    highlights: ["Shibuya", "Asakusa", "Tsukiji", "Day trips to Hakone"],
    estimatedFlightHours: 2.5,
    estimatedBudgetFit: "good",
    bestTimeToVisit: "Mar – May & Sep – Nov",
    vibeMatch: ["Cultural Sites", "Food & Culinary", "Local Markets", "Shopping"],
    imageQuery: "Tokyo skyline Japan",
  },
  {
    id: "east-asia-osaka",
    country: "Japan",
    city: "Osaka",
    region: "Kansai",
    rationale: "Osaka is a lively, compact city that works well for short-haul regional trips.",
    highlights: ["Dotonbori", "Osaka Castle", "Kuromon Market", "Nara day trip"],
    estimatedFlightHours: 2.5,
    estimatedBudgetFit: "excellent",
    bestTimeToVisit: "Mar – May & Oct – Nov",
    vibeMatch: ["Food & Culinary", "Local Markets", "Cultural Sites", "Nightlife"],
    imageQuery: "Osaka Dotonbori Japan",
  },
  {
    id: "east-asia-seoul",
    country: "South Korea",
    city: "Seoul",
    region: "Seoul Capital Area",
    rationale: "Seoul blends fast city energy, food, and culture within a manageable regional flight time.",
    highlights: ["Gyeongbokgung", "Myeongdong", "Bukchon Hanok Village", "Hongdae"],
    estimatedFlightHours: 2,
    estimatedBudgetFit: "good",
    bestTimeToVisit: "Apr – Jun & Sep – Nov",
    vibeMatch: ["Cultural Sites", "Food & Culinary", "Shopping", "Nightlife"],
    imageQuery: "Seoul skyline South Korea",
  },
  {
    id: "east-asia-taipei",
    country: "Taiwan",
    city: "Taipei",
    region: "Taipei",
    rationale: "Taipei is a strong short-trip choice with night markets, temples, and great transit.",
    highlights: ["Taipei 101", "Shilin Night Market", "Longshan Temple", "Beitou"],
    estimatedFlightHours: 2.5,
    estimatedBudgetFit: "good",
    bestTimeToVisit: "Oct – Apr",
    vibeMatch: ["Local Markets", "Food & Culinary", "Cultural Sites", "History"],
    imageQuery: "Taipei 101 Taiwan",
  },
  {
    id: "east-asia-hong-kong",
    country: "Hong Kong",
    city: "Hong Kong",
    region: "Hong Kong",
    rationale: "Hong Kong is a close, dense city break with strong food and skyline appeal.",
    highlights: ["Victoria Peak", "Central", "Mong Kok", "Harbour views"],
    estimatedFlightHours: 2.5,
    estimatedBudgetFit: "good",
    bestTimeToVisit: "Oct – Dec",
    vibeMatch: ["Food & Culinary", "Shopping", "Cultural Sites", "Nightlife"],
    imageQuery: "Hong Kong skyline Victoria Harbour",
  },
  {
    id: "east-asia-fukuoka",
    country: "Japan",
    city: "Fukuoka",
    region: "Kyushu",
    rationale: "Fukuoka is one of the easiest East Asia cities for a short, food-focused trip.",
    highlights: ["Yatai food stalls", "Ohori Park", "Canal City", "Dazaifu Tenmangu"],
    estimatedFlightHours: 2.5,
    estimatedBudgetFit: "excellent",
    bestTimeToVisit: "Mar – May & Oct – Nov",
    vibeMatch: ["Food & Culinary", "Local Markets", "Cultural Sites", "Nature"],
    imageQuery: "Fukuoka Japan canal city",
  },
  {
    id: "east-asia-busan",
    country: "South Korea",
    city: "Busan",
    region: "Busan",
    rationale: "Busan gives you beach, food, and city energy without pushing the travel limit.",
    highlights: ["Haeundae", "Gamcheon Culture Village", "Jagalchi Market", "Gwangalli"],
    estimatedFlightHours: 2,
    estimatedBudgetFit: "good",
    bestTimeToVisit: "Apr – Jun & Sep – Oct",
    vibeMatch: ["Nature", "Food & Culinary", "Cultural Sites", "Local Markets"],
    imageQuery: "Busan skyline South Korea",
  },
  {
    id: "east-asia-macau",
    country: "Macau",
    city: "Macau",
    region: "Macau",
    rationale: "Macau is a compact, near-haul destination with food, heritage, and easy transit.",
    highlights: ["Historic Centre", "Ruins of St. Paul", "Taipa Village", "Largo do Senado"],
    estimatedFlightHours: 2.5,
    estimatedBudgetFit: "excellent",
    bestTimeToVisit: "Oct – Dec",
    vibeMatch: ["Cultural Sites", "Food & Culinary", "History", "Local Markets"],
    imageQuery: "Macau historic centre",
  },
]);

const SOUTHEAST_ASIA_FALLBACKS = createPool([
  {
    id: "southeast-asia-singapore",
    country: "Singapore",
    city: "Singapore",
    region: "Singapore",
    rationale: "Singapore is a fast, efficient regional option with excellent food and easy logistics.",
    highlights: ["Gardens by the Bay", "Chinatown", "Hawker centres", "Marina Bay"],
    estimatedFlightHours: 5,
    estimatedBudgetFit: "good",
    bestTimeToVisit: "Feb – Apr",
    vibeMatch: ["Food & Culinary", "Cultural Sites", "Shopping", "Local Markets"],
    imageQuery: "Singapore skyline Marina Bay",
  },
  {
    id: "southeast-asia-bangkok",
    country: "Thailand",
    city: "Bangkok",
    region: "Bangkok",
    rationale: "Bangkok is a classic nearby bucket option with food, markets, and temple culture.",
    highlights: ["Grand Palace", "Chao Phraya", "Chatuchak Market", "Wat Pho"],
    estimatedFlightHours: 4.5,
    estimatedBudgetFit: "excellent",
    bestTimeToVisit: "Nov – Feb",
    vibeMatch: ["Food & Culinary", "Local Markets", "Cultural Sites", "Nightlife"],
    imageQuery: "Bangkok skyline Thailand",
  },
  {
    id: "southeast-asia-kuala-lumpur",
    country: "Malaysia",
    city: "Kuala Lumpur",
    region: "Kuala Lumpur",
    rationale: "Kuala Lumpur is a budget-friendly gateway city for a short regional break.",
    highlights: ["Petronas Towers", "Batu Caves", "Jalan Alor", "Merdeka Square"],
    estimatedFlightHours: 5,
    estimatedBudgetFit: "excellent",
    bestTimeToVisit: "May – Jul",
    vibeMatch: ["Food & Culinary", "Cultural Sites", "Local Markets", "Shopping"],
    imageQuery: "Kuala Lumpur skyline Malaysia",
  },
  {
    id: "southeast-asia-hanoi",
    country: "Vietnam",
    city: "Hanoi",
    region: "Hanoi",
    rationale: "Hanoi is a strong short-haul choice with history, street food, and walkable districts.",
    highlights: ["Old Quarter", "Hoan Kiem Lake", "Temple of Literature", "Street food"],
    estimatedFlightHours: 4.5,
    estimatedBudgetFit: "excellent",
    bestTimeToVisit: "Oct – Apr",
    vibeMatch: ["Food & Culinary", "History", "Local Markets", "Cultural Sites"],
    imageQuery: "Hanoi Old Quarter Vietnam",
  },
  {
    id: "southeast-asia-ho-chi-minh-city",
    country: "Vietnam",
    city: "Ho Chi Minh City",
    region: "Ho Chi Minh City",
    rationale: "Ho Chi Minh City is a vibrant food and culture destination with short regional reach.",
    highlights: ["Ben Thanh Market", "French colonial architecture", "Cu Chi tunnels", "Rooftop cafes"],
    estimatedFlightHours: 4.5,
    estimatedBudgetFit: "excellent",
    bestTimeToVisit: "Dec – Apr",
    vibeMatch: ["Food & Culinary", "History", "Local Markets", "Cultural Sites"],
    imageQuery: "Ho Chi Minh City skyline Vietnam",
  },
  {
    id: "southeast-asia-da-nang",
    country: "Vietnam",
    city: "Da Nang",
    region: "Da Nang",
    rationale: "Da Nang offers beach, food, and an easier pace for a short regional escape.",
    highlights: ["My Khe Beach", "Dragon Bridge", "Marble Mountains", "Han Market"],
    estimatedFlightHours: 4.5,
    estimatedBudgetFit: "excellent",
    bestTimeToVisit: "Feb – Aug",
    vibeMatch: ["Nature", "Food & Culinary", "Local Markets", "Cultural Sites"],
    imageQuery: "Da Nang beach Vietnam",
  },
  {
    id: "southeast-asia-phuket",
    country: "Thailand",
    city: "Phuket",
    region: "Phuket",
    rationale: "Phuket is the easy beach option in the nearby bucket when you want a lighter trip.",
    highlights: ["Old Town", "Beaches", "Island hopping", "Night markets"],
    estimatedFlightHours: 5,
    estimatedBudgetFit: "good",
    bestTimeToVisit: "Nov – Apr",
    vibeMatch: ["Nature", "Food & Culinary", "Local Markets", "Relaxation"],
    imageQuery: "Phuket Thailand beach",
  },
  {
    id: "southeast-asia-chiang-mai",
    country: "Thailand",
    city: "Chiang Mai",
    region: "Chiang Mai",
    rationale: "Chiang Mai is a calmer, culture-heavy city with strong food and market appeal.",
    highlights: ["Old City temples", "Night Bazaar", "Doi Suthep", "Cooking classes"],
    estimatedFlightHours: 4.5,
    estimatedBudgetFit: "excellent",
    bestTimeToVisit: "Nov – Feb",
    vibeMatch: ["Cultural Sites", "Local Markets", "Food & Culinary", "Nature"],
    imageQuery: "Chiang Mai temple Thailand",
  },
]);

const EUROPE_FALLBACKS = createPool([
  {
    id: "europe-lisbon",
    country: "Portugal",
    city: "Lisbon",
    region: "Estremadura",
    rationale: "Lisbon is a strong value-focused European city break with culture, food, and easy transit.",
    highlights: ["Alfama", "Sintra day trip", "Tram 28", "Fado"],
    estimatedFlightHours: 2.5,
    estimatedBudgetFit: "excellent",
    bestTimeToVisit: "Apr – Jun & Sep – Oct",
    vibeMatch: ["Cultural Sites", "Food & Culinary", "History", "Local Markets"],
    imageQuery: "Lisbon Portugal skyline",
  },
  {
    id: "europe-porto",
    country: "Portugal",
    city: "Porto",
    region: "Norte",
    rationale: "Porto is a compact, high-value European option with food, history, and river views.",
    highlights: ["Ribeira", "Douro river", "Port wine cellars", "Livraria Lello"],
    estimatedFlightHours: 2.5,
    estimatedBudgetFit: "excellent",
    bestTimeToVisit: "May – Oct",
    vibeMatch: ["Food & Culinary", "History", "Cultural Sites", "Local Markets"],
    imageQuery: "Porto Ribeira Portugal",
  },
  {
    id: "europe-barcelona",
    country: "Spain",
    city: "Barcelona",
    region: "Catalonia",
    rationale: "Barcelona is a good fit when the user wants architecture, food, and city energy.",
    highlights: ["Sagrada Familia", "Gothic Quarter", "La Boqueria", "Beachfront"],
    estimatedFlightHours: 2.5,
    estimatedBudgetFit: "good",
    bestTimeToVisit: "Apr – Jun & Sep – Oct",
    vibeMatch: ["Cultural Sites", "Food & Culinary", "Local Markets", "Nightlife"],
    imageQuery: "Barcelona skyline Spain",
  },
  {
    id: "europe-rome",
    country: "Italy",
    city: "Rome",
    region: "Lazio",
    rationale: "Rome is the classic history-heavy European suggestion with predictable air access.",
    highlights: ["Colosseum", "Vatican", "Trastevere", "Roman Forum"],
    estimatedFlightHours: 3,
    estimatedBudgetFit: "good",
    bestTimeToVisit: "Apr – Jun & Sep – Oct",
    vibeMatch: ["History", "Cultural Sites", "Food & Culinary", "Local Markets"],
    imageQuery: "Rome Colosseum Italy",
  },
  {
    id: "europe-athens",
    country: "Greece",
    city: "Athens",
    region: "Attica",
    rationale: "Athens combines ancient sites and modern food culture in a reachable city break.",
    highlights: ["Acropolis", "Plaka", "Monastiraki", "Central Market"],
    estimatedFlightHours: 3.5,
    estimatedBudgetFit: "good",
    bestTimeToVisit: "Apr – Jun & Sep – Oct",
    vibeMatch: ["History", "Cultural Sites", "Food & Culinary", "Local Markets"],
    imageQuery: "Athens Acropolis Greece",
  },
  {
    id: "europe-budapest",
    country: "Hungary",
    city: "Budapest",
    region: "Central Hungary",
    rationale: "Budapest is one of Europe's best-value city breaks for food, baths, and architecture.",
    highlights: ["Buda Castle", "Thermal baths", "Great Market Hall", "Danube views"],
    estimatedFlightHours: 2.5,
    estimatedBudgetFit: "excellent",
    bestTimeToVisit: "Apr – Jun & Sep – Oct",
    vibeMatch: ["History", "Cultural Sites", "Food & Culinary", "Local Markets"],
    imageQuery: "Budapest Parliament Hungary",
  },
  {
    id: "europe-prague",
    country: "Czech Republic",
    city: "Prague",
    region: "Bohemia",
    rationale: "Prague is a high-value European fallback with strong historic appeal and easy city layout.",
    highlights: ["Charles Bridge", "Old Town Square", "Prague Castle", "Cafes"],
    estimatedFlightHours: 2.5,
    estimatedBudgetFit: "good",
    bestTimeToVisit: "Apr – Jun & Sep – Oct",
    vibeMatch: ["History", "Cultural Sites", "Local Markets", "Food & Culinary"],
    imageQuery: "Prague skyline Czech Republic",
  },
  {
    id: "europe-istanbul",
    country: "Turkey",
    city: "Istanbul",
    region: "Marmara",
    rationale: "Istanbul bridges Europe and Asia and gives a strong city-break option with range.",
    highlights: ["Hagia Sophia", "Grand Bazaar", "Bosphorus", "Kadikoy"],
    estimatedFlightHours: 3.5,
    estimatedBudgetFit: "good",
    bestTimeToVisit: "Apr – Jun & Sep – Nov",
    vibeMatch: ["History", "Cultural Sites", "Food & Culinary", "Local Markets"],
    imageQuery: "Istanbul skyline Turkey",
  },
]);

const NORTH_AMERICA_FALLBACKS = createPool([
  {
    id: "north-america-new-york",
    country: "United States",
    city: "New York",
    region: "Northeast",
    rationale: "New York is the obvious high-energy North America fallback for city-focused trips.",
    highlights: ["Central Park", "Museums", "Food neighborhoods", "Broadway"],
    estimatedFlightHours: 5,
    estimatedBudgetFit: "stretch",
    bestTimeToVisit: "Apr – Jun & Sep – Nov",
    vibeMatch: ["Cultural Sites", "Food & Culinary", "Shopping", "Nightlife"],
    imageQuery: "New York skyline Manhattan",
  },
  {
    id: "north-america-chicago",
    country: "United States",
    city: "Chicago",
    region: "Midwest",
    rationale: "Chicago is a strong urban fallback with food, architecture, and lakefront space.",
    highlights: ["Architecture river cruise", "Millennium Park", "Deep-dish pizza", "Museums"],
    estimatedFlightHours: 5,
    estimatedBudgetFit: "good",
    bestTimeToVisit: "May – Oct",
    vibeMatch: ["Cultural Sites", "Food & Culinary", "Shopping", "Local Markets"],
    imageQuery: "Chicago skyline lakefront",
  },
  {
    id: "north-america-los-angeles",
    country: "United States",
    city: "Los Angeles",
    region: "West Coast",
    rationale: "Los Angeles works as a broad North America fallback when the user wants sun and variety.",
    highlights: ["Santa Monica", "Griffith Observatory", "Food trucks", "Museums"],
    estimatedFlightHours: 5,
    estimatedBudgetFit: "stretch",
    bestTimeToVisit: "Mar – May & Sep – Nov",
    vibeMatch: ["Nature", "Food & Culinary", "Shopping", "Nightlife"],
    imageQuery: "Los Angeles skyline California",
  },
  {
    id: "north-america-toronto",
    country: "Canada",
    city: "Toronto",
    region: "Ontario",
    rationale: "Toronto is a reliable North America city option with food, neighborhoods, and transit.",
    highlights: ["CN Tower", "Kensington Market", "Harbourfront", "Museums"],
    estimatedFlightHours: 5,
    estimatedBudgetFit: "good",
    bestTimeToVisit: "May – Oct",
    vibeMatch: ["Food & Culinary", "Local Markets", "Cultural Sites", "Shopping"],
    imageQuery: "Toronto skyline Canada",
  },
  {
    id: "north-america-montreal",
    country: "Canada",
    city: "Montreal",
    region: "Quebec",
    rationale: "Montreal is compact, food-forward, and easy to sell for a North America trip.",
    highlights: ["Old Montreal", "Bagels and cafes", "Mount Royal", "Festivals"],
    estimatedFlightHours: 5,
    estimatedBudgetFit: "good",
    bestTimeToVisit: "May – Oct",
    vibeMatch: ["Food & Culinary", "Cultural Sites", "Local Markets", "History"],
    imageQuery: "Montreal skyline Quebec",
  },
  {
    id: "north-america-mexico-city",
    country: "Mexico",
    city: "Mexico City",
    region: "Central Mexico",
    rationale: "Mexico City is a rich, food-heavy capital with strong value and broad appeal.",
    highlights: ["Roma Norte", "Museums", "Markets", "Historic center"],
    estimatedFlightHours: 5,
    estimatedBudgetFit: "good",
    bestTimeToVisit: "Mar – May & Sep – Nov",
    vibeMatch: ["Food & Culinary", "History", "Cultural Sites", "Local Markets"],
    imageQuery: "Mexico City skyline",
  },
  {
    id: "north-america-san-francisco",
    country: "United States",
    city: "San Francisco",
    region: "West Coast",
    rationale: "San Francisco gives a scenic, food-friendly city fallback with solid travel infrastructure.",
    highlights: ["Golden Gate Bridge", "Ferry Building", "Neighborhood food", "Museums"],
    estimatedFlightHours: 5,
    estimatedBudgetFit: "stretch",
    bestTimeToVisit: "Sep – Nov",
    vibeMatch: ["Food & Culinary", "Cultural Sites", "Nature", "Shopping"],
    imageQuery: "San Francisco skyline bay bridge",
  },
  {
    id: "north-america-seattle",
    country: "United States",
    city: "Seattle",
    region: "Pacific Northwest",
    rationale: "Seattle is a flexible North America fallback with markets, coffee, and waterfront views.",
    highlights: ["Pike Place Market", "Space Needle", "Waterfront", "Museums"],
    estimatedFlightHours: 5,
    estimatedBudgetFit: "stretch",
    bestTimeToVisit: "Jun – Sep",
    vibeMatch: ["Local Markets", "Cultural Sites", "Food & Culinary", "Nature"],
    imageQuery: "Seattle skyline Washington",
  },
]);

const SOUTH_ASIA_FALLBACKS = createPool([
  {
    id: "south-asia-delhi",
    country: "India",
    city: "Delhi",
    region: "Delhi NCR",
    rationale: "Delhi is a major South Asia anchor with broad food, history, and transit access.",
    highlights: ["Old Delhi", "Red Fort", "Markets", "Street food"],
    estimatedFlightHours: 4.5,
    estimatedBudgetFit: "excellent",
    bestTimeToVisit: "Oct – Mar",
    vibeMatch: ["History", "Cultural Sites", "Food & Culinary", "Local Markets"],
    imageQuery: "Delhi India skyline",
  },
  {
    id: "south-asia-mumbai",
    country: "India",
    city: "Mumbai",
    region: "Maharashtra",
    rationale: "Mumbai is a lively South Asia option with excellent food and a strong urban pace.",
    highlights: ["Marine Drive", "Gateway of India", "Markets", "Street food"],
    estimatedFlightHours: 4.5,
    estimatedBudgetFit: "good",
    bestTimeToVisit: "Nov – Feb",
    vibeMatch: ["Food & Culinary", "Cultural Sites", "Shopping", "Local Markets"],
    imageQuery: "Mumbai skyline India",
  },
  {
    id: "south-asia-bangalore",
    country: "India",
    city: "Bangalore",
    region: "Karnataka",
    rationale: "Bangalore is a calmer South Asia city break with strong food and cooler evenings.",
    highlights: ["Cafes", "Parks", "Museums", "Markets"],
    estimatedFlightHours: 4.5,
    estimatedBudgetFit: "good",
    bestTimeToVisit: "Oct – Mar",
    vibeMatch: ["Food & Culinary", "Local Markets", "Nature", "Cultural Sites"],
    imageQuery: "Bangalore skyline India",
  },
  {
    id: "south-asia-chennai",
    country: "India",
    city: "Chennai",
    region: "Tamil Nadu",
    rationale: "Chennai offers temples, food, and a coastal South Asia alternative.",
    highlights: ["Marina Beach", "Temples", "South Indian food", "Markets"],
    estimatedFlightHours: 4.5,
    estimatedBudgetFit: "excellent",
    bestTimeToVisit: "Nov – Feb",
    vibeMatch: ["Food & Culinary", "Cultural Sites", "Nature", "Local Markets"],
    imageQuery: "Chennai India beach",
  },
  {
    id: "south-asia-kolkata",
    country: "India",
    city: "Kolkata",
    region: "West Bengal",
    rationale: "Kolkata brings heritage, food, and a distinct cultural identity to the South Asia pool.",
    highlights: ["Victoria Memorial", "Markets", "Cafes", "Colonial architecture"],
    estimatedFlightHours: 4.5,
    estimatedBudgetFit: "excellent",
    bestTimeToVisit: "Oct – Mar",
    vibeMatch: ["History", "Cultural Sites", "Food & Culinary", "Local Markets"],
    imageQuery: "Kolkata skyline India",
  },
  {
    id: "south-asia-kathmandu",
    country: "Nepal",
    city: "Kathmandu",
    region: "Bagmati",
    rationale: "Kathmandu is a compact South Asia destination with strong cultural depth and easy pacing.",
    highlights: ["Durbar Square", "Temples", "Thamel", "Day trips"],
    estimatedFlightHours: 4.5,
    estimatedBudgetFit: "good",
    bestTimeToVisit: "Oct – Dec & Feb – Apr",
    vibeMatch: ["Cultural Sites", "History", "Local Markets", "Nature"],
    imageQuery: "Kathmandu Nepal temples",
  },
  {
    id: "south-asia-colombo",
    country: "Sri Lanka",
    city: "Colombo",
    region: "Western Province",
    rationale: "Colombo is a strong short regional option with food, coast, and easy logistics.",
    highlights: ["Galle Face", "Markets", "Beaches", "Street food"],
    estimatedFlightHours: 4.5,
    estimatedBudgetFit: "good",
    bestTimeToVisit: "Dec – Mar",
    vibeMatch: ["Food & Culinary", "Nature", "Local Markets", "Cultural Sites"],
    imageQuery: "Colombo skyline Sri Lanka",
  },
  {
    id: "south-asia-dhaka",
    country: "Bangladesh",
    city: "Dhaka",
    region: "Dhaka Division",
    rationale: "Dhaka is a dense South Asia city option with markets, food, and strong regional character.",
    highlights: ["Old Dhaka", "Markets", "Riverfront", "Food"],
    estimatedFlightHours: 4.5,
    estimatedBudgetFit: "excellent",
    bestTimeToVisit: "Nov – Feb",
    vibeMatch: ["Food & Culinary", "Local Markets", "History", "Cultural Sites"],
    imageQuery: "Dhaka skyline Bangladesh",
  },
]);

const FALLBACK_DESTINATIONS_BY_BUCKET: Record<TravelHint["bucket"], Destination[]> = {
  "east-asia": EAST_ASIA_FALLBACKS,
  "southeast-asia": SOUTHEAST_ASIA_FALLBACKS,
  europe: EUROPE_FALLBACKS,
  "north-america": NORTH_AMERICA_FALLBACKS,
  "south-asia": SOUTH_ASIA_FALLBACKS,
};

const DEFAULT_FALLBACK_DESTINATIONS = createPool([
  EAST_ASIA_FALLBACKS[0],
  SOUTHEAST_ASIA_FALLBACKS[0],
  EUROPE_FALLBACKS[0],
  NORTH_AMERICA_FALLBACKS[0],
  SOUTH_ASIA_FALLBACKS[0],
  EAST_ASIA_FALLBACKS[1],
  SOUTHEAST_ASIA_FALLBACKS[1],
  EUROPE_FALLBACKS[1],
]);

function toStringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

function defaultFlightHours(homeCity?: string, destCity?: string, fallbackHours = 4) {
  if (!homeCity || !destCity) return fallbackHours;
  if (homeCity.toLowerCase() === destCity.toLowerCase()) return 0;
  return fallbackHours;
}

function normalizeDestinationCandidate(
  value: unknown,
  index: number,
  fallbackDestinations: Destination[]
): Destination {
  const fallback = fallbackDestinations[index % fallbackDestinations.length];
  const source = value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const city = toStringValue(source.city, fallback.city);
  const country = toStringValue(source.country, fallback.country);

  return {
    id: toStringValue(source.id, fallback.id),
    country,
    city,
    region: typeof source.region === "string" && source.region.trim() ? source.region.trim() : fallback.region,
    rationale: toStringValue(
      source.rationale,
      `Suggested for ${city}${country ? ", " + country : ""} based on the user budget and travel preferences.`
    ),
    highlights: toStringArray(source.highlights).length > 0 ? toStringArray(source.highlights) : fallback.highlights,
    estimatedFlightHours:
      typeof source.estimatedFlightHours === "number" && Number.isFinite(source.estimatedFlightHours)
        ? source.estimatedFlightHours
        : defaultFlightHours(undefined, city, fallback.estimatedFlightHours),
    estimatedBudgetFit:
      source.estimatedBudgetFit === "excellent" || source.estimatedBudgetFit === "good" || source.estimatedBudgetFit === "stretch"
        ? source.estimatedBudgetFit
        : fallback.estimatedBudgetFit,
    bestTimeToVisit: toStringValue(source.bestTimeToVisit, fallback.bestTimeToVisit),
    vibeMatch: toStringArray(source.vibeMatch).length > 0 ? toStringArray(source.vibeMatch) : fallback.vibeMatch,
    imageQuery: toStringValue(source.imageQuery, `${city}${country ? " " + country : ""}`.trim() || fallback.imageQuery),
    verifiedThroughLiveSearch:
      typeof source.verifiedThroughLiveSearch === "boolean" ? source.verifiedThroughLiveSearch : false,
  };
}

export function getFallbackDestinations(travelHint: TravelHint | null): Destination[] {
  if (!travelHint) return DEFAULT_FALLBACK_DESTINATIONS;
  return FALLBACK_DESTINATIONS_BY_BUCKET[travelHint.bucket];
}

export function normalizeDestinationList(
  value: unknown[],
  fallbackDestinations: Destination[],
  minCount = 8
): Destination[] {
  const seen = new Set<string>();
  const normalized: Destination[] = [];

  const addDestination = (candidate: Destination) => {
    const key = `${candidate.city.trim().toLowerCase()}|${candidate.country.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    normalized.push(candidate);
    return true;
  };

  const effectiveFallbacks = fallbackDestinations.length > 0 ? fallbackDestinations : DEFAULT_FALLBACK_DESTINATIONS;

  value.slice(0, 10).forEach((item, index) => {
    addDestination(normalizeDestinationCandidate(item, index, effectiveFallbacks));
  });

  let fallbackIndex = 0;
  const maxAttempts = effectiveFallbacks.length * 3;
  while (normalized.length < minCount && fallbackIndex < maxAttempts) {
    addDestination(normalizeDestinationCandidate({}, normalized.length + fallbackIndex, effectiveFallbacks));
    fallbackIndex++;
  }

  return normalized;
}

export function buildBucketAwareDestinationCandidates(
  value: unknown[],
  travelHint: TravelHint | null,
  minCount = 8
): Destination[] {
  const fallbackDestinations = getFallbackDestinations(travelHint);
  const normalized = normalizeDestinationList(value, fallbackDestinations, minCount);
  if (!travelHint) return normalized;

  const filtered = normalized.filter((destination) => destinationMatchesTravelHint(destination, travelHint));
  if (filtered.length >= minCount) return filtered;

  const backfill = normalizeDestinationList([], fallbackDestinations, minCount).filter((destination) =>
    destinationMatchesTravelHint(destination, travelHint)
  );
  const merged: Destination[] = [];
  const seen = new Set<string>();

  const add = (destination: Destination) => {
    const key = `${destination.city.trim().toLowerCase()}|${destination.country.trim().toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(destination);
  };

  filtered.forEach(add);
  backfill.forEach(add);

  return merged.slice(0, Math.max(minCount, merged.length));
}
