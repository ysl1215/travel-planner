/**
 * Static train cost estimates for common European city pairs.
 * Prices are approximate one-way adult fares in EUR (advance booking).
 * Source: Trainline / Eurail public pricing, 2024-2025.
 */

// European cities we consider "in-region" for train travel
const EU_TRAIN_CITIES = new Set([
  "london","paris","amsterdam","brussels","cologne","frankfurt","munich","berlin",
  "hamburg","zurich","basel","geneva","bern","vienna","salzburg","innsbruck",
  "prague","budapest","warsaw","krakow","kraków","bratislava","ljubljana",
  "zagreb","barcelona","madrid","seville","valencia","lisbon","porto",
  "rome","milan","florence","venice","naples","bologna","turin",
  "marseille","lyon","bordeaux","toulouse","nice","strasbourg","lille",
  "rotterdam","the hague","antwerp","ghent","bruges","luxembourg",
  "copenhagen","stockholm","oslo","helsinki","gothenburg","malmo","malmö",
  "edinburgh","manchester","birmingham","bristol","glasgow",
]);

// Approximate one-way fares in EUR (advance). Symmetric — stored once, looked up both ways.
// Format: "cityA|cityB" (alphabetical order) → [minFare, typicalFare]
const TRAIN_FARES: Record<string, [number, number]> = {
  "amsterdam|brussels":    [20,  45],
  "amsterdam|cologne":     [25,  50],
  "amsterdam|london":      [55, 110],
  "amsterdam|paris":       [35,  80],
  "barcelona|madrid":      [30,  70],
  "barcelona|paris":       [50, 110],
  "berlin|frankfurt":      [30,  80],
  "berlin|hamburg":        [25,  60],
  "berlin|munich":         [35,  90],
  "berlin|paris":          [60, 130],
  "berlin|prague":         [25,  55],
  "berlin|warsaw":         [30,  60],
  "brussels|london":       [50, 100],
  "brussels|paris":        [20,  60],
  "budapest|prague":       [25,  55],
  "budapest|vienna":       [20,  45],
  "cologne|frankfurt":     [20,  50],
  "cologne|paris":         [30,  75],
  "florence|rome":         [20,  45],
  "florence|venice":       [20,  40],
  "frankfurt|munich":      [25,  65],
  "frankfurt|paris":       [40,  90],
  "frankfurt|zurich":      [30,  70],
  "london|manchester":     [25,  70],
  "london|paris":          [50, 100],
  "lyon|paris":            [30,  70],
  "madrid|seville":        [25,  55],
  "milan|rome":            [30,  70],
  "milan|venice":          [15,  35],
  "milan|zurich":          [30,  65],
  "munich|vienna":         [25,  55],
  "munich|zurich":         [30,  65],
  "paris|strasbourg":      [25,  60],
  "paris|toulouse":        [35,  80],
  "paris|zurich":          [40,  90],
  "prague|vienna":         [20,  45],
  "rome|venice":           [35,  75],
  "vienna|zurich":         [40,  85],
};

function normalise(city: string): string {
  return city.toLowerCase().trim().replace(/ó/g, "o").replace(/ö/g, "o");
}

function fareKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

export interface TrainEstimate {
  minFare: number;   // EUR, advance booking
  typicalFare: number;
  currency: "EUR";
  note: string;
}

/**
 * Returns a rough train fare estimate between two European cities, or null if
 * either city is not in the European train network or no estimate is available.
 */
export function getTrainEstimate(originCity: string, destCity: string): TrainEstimate | null {
  const o = normalise(originCity);
  const d = normalise(destCity);

  if (!EU_TRAIN_CITIES.has(o) || !EU_TRAIN_CITIES.has(d)) return null;

  const key = fareKey(o, d);
  const fare = TRAIN_FARES[key];

  if (fare) {
    return { minFare: fare[0], typicalFare: fare[1], currency: "EUR", note: "Advance booking estimate" };
  }

  // Both cities are European but no direct pair — return a generic intra-EU estimate
  return { minFare: 30, typicalFare: 80, currency: "EUR", note: "Rough intra-European estimate" };
}

export function isEuropeanCity(city: string): boolean {
  return EU_TRAIN_CITIES.has(normalise(city));
}
