/**
 * Independent flight time estimation using great-circle distance.
 *
 * Used to validate/override AI-reported flight hours so that destinations
 * clearly outside the user's maxTravelHours constraint are filtered out
 * regardless of what the model claims.
 */

// Lat/lon for major cities (covers most common origins and destinations)
const CITY_COORDS: Record<string, [number, number]> = {
  // East Asia
  "shanghai": [31.23, 121.47],
  "beijing": [39.91, 116.40],
  "guangzhou": [23.13, 113.26],
  "shenzhen": [22.54, 114.06],
  "chengdu": [30.57, 104.07],
  "hong kong": [22.32, 114.17],
  "taipei": [25.03, 121.57],
  "tokyo": [35.68, 139.69],
  "osaka": [34.69, 135.50],
  "seoul": [37.57, 126.98],
  "busan": [35.18, 129.08],
  // Southeast Asia
  "singapore": [1.35, 103.82],
  "bangkok": [13.76, 100.50],
  "kuala lumpur": [3.14, 101.69],
  "hanoi": [21.03, 105.85],
  "ho chi minh city": [10.82, 106.63],
  "manila": [14.60, 120.98],
  "jakarta": [-6.21, 106.85],
  "bali": [-8.65, 115.22],
  "phnom penh": [11.56, 104.92],
  "siem reap": [13.36, 103.86],
  "chiang mai": [18.79, 98.98],
  // South Asia
  "mumbai": [19.08, 72.88],
  "delhi": [28.61, 77.21],
  "bangalore": [12.97, 77.59],
  "colombo": [6.93, 79.84],
  "kathmandu": [27.72, 85.32],
  // Middle East
  "dubai": [25.20, 55.27],
  "doha": [25.29, 51.53],
  "abu dhabi": [24.45, 54.65],
  "riyadh": [24.71, 46.67],
  "istanbul": [41.01, 28.98],
  "tel aviv": [32.08, 34.78],
  "cairo": [30.04, 31.24],
  // Europe
  "london": [51.51, -0.13],
  "paris": [48.86, 2.35],
  "amsterdam": [52.37, 4.90],
  "berlin": [52.52, 13.41],
  "munich": [48.14, 11.58],
  "frankfurt": [50.11, 8.68],
  "rome": [41.90, 12.50],
  "milan": [45.46, 9.19],
  "madrid": [40.42, -3.70],
  "barcelona": [41.39, 2.17],
  "lisbon": [38.72, -9.14],
  "vienna": [48.21, 16.37],
  "zurich": [47.38, 8.54],
  "prague": [50.08, 14.44],
  "budapest": [47.50, 19.04],
  "warsaw": [52.23, 21.01],
  "stockholm": [59.33, 18.07],
  "copenhagen": [55.68, 12.57],
  "oslo": [59.91, 10.75],
  "helsinki": [60.17, 24.94],
  "dublin": [53.35, -6.26],
  "edinburgh": [55.95, -3.19],
  "athens": [37.98, 23.73],
  "bucharest": [44.43, 26.10],
  "sofia": [42.70, 23.32],
  "zagreb": [45.81, 15.98],
  "belgrade": [44.79, 20.47],
  "sarajevo": [43.86, 18.41],
  "dubrovnik": [42.65, 18.09],
  "split": [43.51, 16.44],
  "krakow": [50.06, 19.94],
  "porto": [41.15, -8.61],
  "seville": [37.39, -5.98],
  "valencia": [39.47, -0.38],
  "lyon": [45.76, 4.84],
  "bordeaux": [44.84, -0.58],
  "nice": [43.71, 7.26],
  "florence": [43.77, 11.25],
  "venice": [45.44, 12.32],
  "naples": [40.85, 14.27],
  "thessaloniki": [40.64, 22.94],
  "tallinn": [59.44, 24.75],
  "riga": [56.95, 24.11],
  "vilnius": [54.69, 25.28],
  // East Asia (expanded)
  "kyoto": [35.01, 135.77],
  "fukuoka": [33.59, 130.40],
  "sapporo": [43.06, 141.35],
  "kunming": [25.04, 102.68],
  "xian": [34.26, 108.94],
  "hangzhou": [30.27, 120.15],
  "nanjing": [32.06, 118.80],
  // Southeast Asia (expanded)
  "hoi an": [15.88, 108.33],
  "da nang": [16.05, 108.22],
  "luang prabang": [19.89, 102.13],
  "yogyakarta": [-7.80, 110.36],
  "penang": [5.41, 100.33],
  "cebu": [10.31, 123.89],
  // Other
  "moscow": [55.76, 37.62],
  "st petersburg": [59.93, 30.32],
  "reykjavik": [64.15, -21.94],
  "tbilisi": [41.72, 44.79],
  "baku": [40.41, 49.87],
  // Africa
  "johannesburg": [-26.20, 28.05],
  "cape town": [-33.93, 18.42],
  "nairobi": [-1.29, 36.82],
  "lagos": [6.52, 3.38],
  "casablanca": [33.57, -7.59],
  "marrakech": [31.63, -8.01],
  "addis ababa": [9.02, 38.75],
  "dar es salaam": [-6.79, 39.28],
  // North America
  "new york": [40.71, -74.01],
  "los angeles": [34.05, -118.24],
  "san francisco": [37.77, -122.42],
  "chicago": [41.88, -87.63],
  "miami": [25.76, -80.19],
  "toronto": [43.65, -79.38],
  "vancouver": [49.28, -123.12],
  "montreal": [45.50, -73.57],
  "mexico city": [19.43, -99.13],
  "houston": [29.76, -95.37],
  "dallas": [32.78, -96.80],
  "seattle": [47.61, -122.33],
  "boston": [42.36, -71.06],
  "washington dc": [38.91, -77.04],
  "atlanta": [33.75, -84.39],
  "denver": [39.74, -104.99],
  "honolulu": [21.31, -157.86],
  // South America
  "sao paulo": [-23.55, -46.63],
  "rio de janeiro": [-22.91, -43.17],
  "buenos aires": [-34.60, -58.38],
  "lima": [-12.05, -77.04],
  "bogota": [4.71, -74.07],
  "santiago": [-33.45, -70.67],
  "medellin": [6.25, -75.56],
  // Oceania
  "sydney": [-33.87, 151.21],
  "melbourne": [-37.81, 144.96],
  "brisbane": [-27.47, 153.03],
  "auckland": [-36.85, 174.76],
  "perth": [-31.95, 115.86],
};

// Common alternate names
const CITY_ALIASES: Record<string, string> = {
  "nyc": "new york",
  "la": "los angeles",
  "sf": "san francisco",
  "dc": "washington dc",
  "hcmc": "ho chi minh city",
  "saigon": "ho chi minh city",
  "kl": "kuala lumpur",
  "bkk": "bangkok",
  "sgn": "ho chi minh city",
  "pvg": "shanghai",
  "hkg": "hong kong",
  "tpe": "taipei",
  "nrt": "tokyo",
  "hnd": "tokyo",
  "icn": "seoul",
  "sin": "singapore",
  "lhr": "london",
  "cdg": "paris",
  "ams": "amsterdam",
  "fco": "rome",
  "mad": "madrid",
  "bcn": "barcelona",
  "jfk": "new york",
  "lax": "los angeles",
  "sfo": "san francisco",
  "ord": "chicago",
  "syd": "sydney",
  "mel": "melbourne",
};

function normalizeCity(city: string): string {
  const lower = city.toLowerCase().trim();
  return CITY_ALIASES[lower] ?? lower;
}

function getCoords(city: string): [number, number] | null {
  const key = normalizeCity(city);
  return CITY_COORDS[key] ?? null;
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function distanceToFlightHours(distanceKm: number): number {
  // Average cruise speed ~850 km/h, but effective speed including
  // climb/descent/routing overhead is ~750 km/h.
  // Add 0.5h for taxi, takeoff, and landing.
  if (distanceKm < 200) return 0.5;
  return distanceKm / 750 + 0.5;
}

/**
 * Estimate flight hours between two cities using great-circle distance.
 * Returns null if either city is not in the coordinate table.
 */
export function estimateFlightHours(originCity: string, destinationCity: string): number | null {
  const origin = getCoords(originCity);
  const dest = getCoords(destinationCity);
  if (!origin || !dest) return null;

  const distance = haversineDistanceKm(origin[0], origin[1], dest[0], dest[1]);
  return Math.round(distanceToFlightHours(distance) * 10) / 10;
}

// ─── Nominatim geocoding fallback ───────────────────────────────────────────

// Cache geocoded results to avoid repeat lookups within the same server lifetime
const geocodeCache = new Map<string, [number, number] | null>();

async function geocodeCity(city: string): Promise<[number, number] | null> {
  const key = city.toLowerCase().trim();
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "travel-planner-ai/1.0" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      geocodeCache.set(key, null);
      return null;
    }
    const data = await res.json();
    if (!data.length) {
      geocodeCache.set(key, null);
      return null;
    }
    const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    geocodeCache.set(key, coords);
    return coords;
  } catch {
    geocodeCache.set(key, null);
    return null;
  }
}

/**
 * Async version of estimateFlightHours that falls back to Nominatim geocoding
 * for cities not in the static table. Use this in server-side API routes.
 */
export async function estimateFlightHoursAsync(originCity: string, destinationCity: string): Promise<number | null> {
  // Try static table first (no network call)
  const staticResult = estimateFlightHours(originCity, destinationCity);
  if (staticResult !== null) return staticResult;

  // Geocode both cities in parallel (staggered by 1.1s for Nominatim rate limit)
  const originCoords = getCoords(originCity);
  const destCoords = getCoords(destinationCity);

  const [origin, dest] = await Promise.all([
    originCoords ?? geocodeCity(originCity),
    destCoords ?? delay(1_100).then(() => geocodeCity(destinationCity)),
  ]);

  if (!origin || !dest) return null;

  const distance = haversineDistanceKm(origin[0], origin[1], dest[0], dest[1]);
  return Math.round(distanceToFlightHours(distance) * 10) / 10;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Country-based sanity check ─────────────────────────────────────────────

const COUNTRY_REGIONS: Record<string, string> = {
  // Europe
  "france": "europe", "germany": "europe", "italy": "europe", "spain": "europe",
  "uk": "europe", "united kingdom": "europe", "portugal": "europe", "netherlands": "europe",
  "belgium": "europe", "austria": "europe", "switzerland": "europe", "greece": "europe",
  "czech republic": "europe", "czechia": "europe", "poland": "europe", "hungary": "europe",
  "croatia": "europe", "sweden": "europe", "norway": "europe", "denmark": "europe",
  "finland": "europe", "ireland": "europe", "romania": "europe", "bulgaria": "europe",
  "serbia": "europe", "slovenia": "europe", "bosnia": "europe", "montenegro": "europe",
  "albania": "europe", "north macedonia": "europe", "iceland": "europe",
  "estonia": "europe", "latvia": "europe", "lithuania": "europe", "slovakia": "europe",
  // East Asia
  "japan": "east_asia", "south korea": "east_asia", "korea": "east_asia",
  "china": "east_asia", "taiwan": "east_asia", "hong kong": "east_asia",
  // Southeast Asia
  "thailand": "southeast_asia", "vietnam": "southeast_asia", "indonesia": "southeast_asia",
  "malaysia": "southeast_asia", "philippines": "southeast_asia", "singapore": "southeast_asia",
  "cambodia": "southeast_asia", "laos": "southeast_asia", "myanmar": "southeast_asia",
  // South Asia
  "india": "south_asia", "sri lanka": "south_asia", "nepal": "south_asia",
  "bangladesh": "south_asia", "pakistan": "south_asia",
  // Middle East
  "turkey": "middle_east", "uae": "middle_east", "united arab emirates": "middle_east",
  "qatar": "middle_east", "saudi arabia": "middle_east", "israel": "middle_east",
  "egypt": "middle_east", "jordan": "middle_east", "oman": "middle_east",
  // Americas
  "usa": "americas", "united states": "americas", "canada": "americas",
  "mexico": "americas", "brazil": "americas", "argentina": "americas",
  "colombia": "americas", "peru": "americas", "chile": "americas",
  // Oceania
  "australia": "oceania", "new zealand": "oceania",
  // Africa
  "south africa": "africa", "kenya": "africa", "tanzania": "africa",
  "morocco": "africa", "nigeria": "africa", "ethiopia": "africa",
  // Central Asia / Caucasus
  "georgia": "caucasus", "armenia": "caucasus", "azerbaijan": "caucasus",
  "uzbekistan": "central_asia", "kazakhstan": "central_asia",
};

const MIN_HOURS_BETWEEN_REGIONS: Record<string, Record<string, number>> = {
  "east_asia":      { "europe": 9, "americas": 10, "africa": 10, "oceania": 7, "middle_east": 6, "south_asia": 5 },
  "southeast_asia": { "europe": 9, "americas": 12, "africa": 10, "oceania": 6, "middle_east": 6 },
  "south_asia":     { "europe": 7, "americas": 14, "east_asia": 5, "oceania": 9 },
  "europe":         { "east_asia": 9, "southeast_asia": 9, "oceania": 18, "americas": 7, "south_asia": 7 },
  "americas":       { "europe": 7, "east_asia": 10, "southeast_asia": 12, "oceania": 12, "africa": 9 },
  "oceania":        { "europe": 18, "americas": 12, "east_asia": 7, "southeast_asia": 6, "africa": 14 },
  "africa":         { "east_asia": 10, "americas": 9, "oceania": 14, "europe": 4 },
  "middle_east":    { "east_asia": 6, "americas": 12, "europe": 4, "oceania": 12 },
};

function getCountryRegion(country: string): string | null {
  return COUNTRY_REGIONS[country.toLowerCase().trim()] ?? null;
}

function getCityRegion(city: string): string | null {
  const coords = getCoords(city);
  if (!coords) return null;
  const [lat, lon] = coords;
  // Rough bounding-box region inference from coordinates
  if (lat > 20 && lon > 100 && lon < 145) return "east_asia";
  if (lat > -10 && lat <= 20 && lon > 90 && lon < 140) return "southeast_asia";
  if (lat > 5 && lat < 40 && lon > 60 && lon <= 100) return "south_asia";
  if (lat > 35 && lon > -30 && lon < 45) return "europe";
  if (lon < -30) return "americas";
  if (lat < -10 && lon > 100) return "oceania";
  if (lat > 10 && lat < 40 && lon >= 25 && lon < 60) return "middle_east";
  if (lat < 35 && lat > -40 && lon > -20 && lon < 55) return "africa";
  return null;
}

/**
 * Sanity-check whether a claimed flight time between a home city and a destination
 * (identified by country) is plausible. Returns null if we can't determine,
 * or a corrected minimum if the claim is clearly hallucinated.
 */
export function sanityCheckFlightHours(
  homeCity: string,
  destCountry: string,
  claimedHours: number
): number | null {
  const homeRegion = getCityRegion(homeCity);
  const destRegion = getCountryRegion(destCountry);
  if (!homeRegion || !destRegion) return null;
  if (homeRegion === destRegion) return null; // same region, trust the claim

  const minHours = MIN_HOURS_BETWEEN_REGIONS[homeRegion]?.[destRegion]
    ?? MIN_HOURS_BETWEEN_REGIONS[destRegion]?.[homeRegion];

  if (!minHours) return null;

  // If claimed hours are less than minimum plausible, it's hallucinated
  if (claimedHours < minHours * 0.7) {
    return minHours;
  }

  return null; // claim is plausible
}

/**
 * Check whether a destination is reachable within maxHours from origin.
 * Returns { reachable, estimatedHours } or null if we can't determine.
 */
export function checkReachability(
  originCity: string,
  destinationCity: string,
  maxHours: number
): { reachable: boolean; estimatedHours: number } | null {
  const hours = estimateFlightHours(originCity, destinationCity);
  if (hours === null) return null;
  return { reachable: hours <= maxHours, estimatedHours: hours };
}

/**
 * Returns true if the city is in our coordinate table (i.e. we can validate it).
 */
export function hasCoordinates(city: string): boolean {
  return getCoords(city) !== null;
}
