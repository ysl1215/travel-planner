export type TravelBucket =
  | "east-asia"
  | "southeast-asia"
  | "europe"
  | "north-america"
  | "south-asia";

export type TravelHint = {
  bucket: TravelBucket;
  strict: boolean;
  preferredRegions: string[];
  preferredCountries: string[];
  avoidRegions: string[];
  avoidCountries: string[];
  examples: string[];
};

type BucketConfig = Omit<TravelHint, "bucket" | "strict">;

const normalize = (value: string) => value.trim().toLowerCase();

const EAST_ASIA: BucketConfig = {
  preferredRegions: ["East Asia", "Southeast Asia"],
  preferredCountries: [
    "China",
    "Japan",
    "South Korea",
    "Taiwan",
    "Hong Kong",
    "Macau",
    "Mongolia",
  ],
  avoidRegions: ["Europe", "North America", "South America", "Africa", "Oceania"],
  avoidCountries: [
    "France",
    "Germany",
    "Italy",
    "Spain",
    "United Kingdom",
    "United States",
    "Canada",
    "Brazil",
    "Australia",
    "New Zealand",
  ],
  examples: ["Tokyo", "Osaka", "Taipei", "Hong Kong", "Seoul", "Fukuoka"],
};

const SOUTHEAST_ASIA: BucketConfig = {
  preferredRegions: ["Southeast Asia", "East Asia"],
  preferredCountries: [
    "Singapore",
    "Thailand",
    "Malaysia",
    "Vietnam",
    "Indonesia",
    "Philippines",
    "Cambodia",
    "Laos",
    "Brunei",
    "Myanmar",
  ],
  avoidRegions: ["Europe", "North America", "South America", "Africa", "Oceania"],
  avoidCountries: [
    "France",
    "Germany",
    "Italy",
    "Spain",
    "United Kingdom",
    "United States",
    "Canada",
    "Brazil",
    "Australia",
    "New Zealand",
  ],
  examples: ["Singapore", "Bangkok", "Kuala Lumpur", "Hanoi", "Ho Chi Minh City", "Phuket"],
};

const EUROPE: BucketConfig = {
  preferredRegions: ["Europe", "North Africa", "Middle East"],
  preferredCountries: [
    "United Kingdom",
    "Ireland",
    "France",
    "Germany",
    "Spain",
    "Italy",
    "Portugal",
    "Netherlands",
    "Belgium",
    "Switzerland",
    "Austria",
    "Czech Republic",
    "Poland",
    "Hungary",
    "Greece",
    "Turkey",
    "Morocco",
    "Tunisia",
    "Egypt",
  ],
  avoidRegions: ["East Asia", "Southeast Asia", "North America", "South America", "Oceania"],
  avoidCountries: [
    "China",
    "Japan",
    "South Korea",
    "United States",
    "Canada",
    "Brazil",
    "Australia",
    "New Zealand",
  ],
  examples: ["Lisbon", "Barcelona", "Rome", "Athens", "Istanbul", "Prague"],
};

const NORTH_AMERICA: BucketConfig = {
  preferredRegions: ["North America", "Caribbean", "Central America"],
  preferredCountries: ["United States", "Canada", "Mexico", "Cuba", "Jamaica", "Dominican Republic"],
  avoidRegions: ["Europe", "East Asia", "Southeast Asia", "South America", "Africa", "Oceania"],
  avoidCountries: ["France", "Germany", "Italy", "China", "Japan", "Australia", "Brazil"],
  examples: ["Toronto", "Montreal", "Mexico City", "New York", "Los Angeles", "Chicago"],
};

const SOUTH_ASIA: BucketConfig = {
  preferredRegions: ["South Asia", "Middle East"],
  preferredCountries: ["India", "Nepal", "Sri Lanka", "Bangladesh", "Bhutan", "Pakistan"],
  avoidRegions: ["Europe", "North America", "South America", "Africa", "Oceania"],
  avoidCountries: ["France", "Germany", "Italy", "United States", "Canada", "Australia", "Brazil"],
  examples: ["Delhi", "Mumbai", "Kathmandu", "Colombo", "Jaipur", "Bangalore"],
};

const HOME_BUCKETS: Array<{ patterns: string[]; bucket: TravelBucket }> = [
  {
    patterns: ["shanghai", "beijing", "hong kong", "taipei", "tokyo", "osaka", "seoul", "busan", "fukuoka", "nagoya", "sapporo", "guangzhou", "shenzhen", "hangzhou", "nanjing", "wuhan", "chengdu", "chongqing", "xiamen", "macau"],
    bucket: "east-asia",
  },
  {
    patterns: ["singapore", "bangkok", "kuala lumpur", "jakarta", "manila", "hanoi", "ho chi minh", "da nang", "phuket", "chiang mai", "phnom penh", "siem reap", "bali"],
    bucket: "southeast-asia",
  },
  {
    patterns: ["london", "paris", "amsterdam", "frankfurt", "madrid", "barcelona", "rome", "milan", "vienna", "zurich", "brussels", "copenhagen", "stockholm", "oslo", "helsinki", "warsaw", "prague", "budapest", "krakow", "bucharest", "sofia", "zagreb", "belgrade", "sarajevo", "lisbon", "porto", "athens", "istanbul", "dublin"],
    bucket: "europe",
  },
  {
    patterns: ["new york", "los angeles", "chicago", "toronto", "montreal", "mexico city"],
    bucket: "north-america",
  },
  {
    patterns: ["delhi", "mumbai", "bangalore", "bengaluru", "chennai", "kolkata", "kathmandu", "colombo", "dhaka"],
    bucket: "south-asia",
  },
];

const BUCKET_CONFIGS: Record<TravelBucket, BucketConfig> = {
  "east-asia": EAST_ASIA,
  "southeast-asia": SOUTHEAST_ASIA,
  europe: EUROPE,
  "north-america": NORTH_AMERICA,
  "south-asia": SOUTH_ASIA,
};

export function getTravelHint(homeCity: string, maxTravelHours?: number): TravelHint | null {
  const lower = normalize(homeCity);
  const bucketEntry = HOME_BUCKETS.find(({ patterns }) => patterns.some((pattern) => lower.includes(pattern)));
  if (!bucketEntry) return null;

  const strict = typeof maxTravelHours === "number" && Number.isFinite(maxTravelHours) && maxTravelHours <= 4;
  const config = BUCKET_CONFIGS[bucketEntry.bucket];

  return {
    bucket: bucketEntry.bucket,
    strict,
    preferredRegions: config.preferredRegions,
    preferredCountries: config.preferredCountries,
    avoidRegions: config.avoidRegions,
    avoidCountries: config.avoidCountries,
    examples: config.examples,
  };
}

function matchesAny(value: string, needles: string[]) {
  const haystack = normalize(value);
  return needles.some((needle) => haystack.includes(normalize(needle)));
}

export function destinationMatchesTravelHint(
  destination: { country: string; region?: string },
  hint: TravelHint | null
): boolean {
  if (!hint) return true;

  const region = destination.region ?? "";
  if (matchesAny(region, hint.avoidRegions) || matchesAny(destination.country, hint.avoidCountries)) {
    return false;
  }

  if (!hint.strict) {
    return true;
  }

  return matchesAny(region, hint.preferredRegions) || matchesAny(destination.country, hint.preferredCountries);
}

export function formatTravelHintBlock(homeCity: string, maxTravelHours: number | undefined, hint: TravelHint | null) {
  if (!hint || typeof maxTravelHours !== "number" || !Number.isFinite(maxTravelHours)) return "";

  return `\nOrigin-aware guidance:\n- Home city: ${homeCity}\n- Travel limit: ${maxTravelHours} hours\n- Nearby bucket: ${hint.bucket}\n- Prioritize: ${hint.preferredRegions.join(", ")}\n- Avoid: ${hint.avoidRegions.join(", ")}\n- Examples: ${hint.examples.join(", ")}\n- Do not drift to faraway regions if the limit is tight; stay within the nearby bucket and only suggest cities that are plausibly reachable within the travel limit.\n`;
}
