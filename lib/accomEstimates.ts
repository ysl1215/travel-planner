/**
 * Static accommodation cost estimates by city.
 * Prices are approximate per-night costs in USD for a single room.
 * Tiers: hostel dorm, budget private, mid-range hotel.
 * Sources: Hostelworld, Booking.com averages 2024-2025.
 */

export interface AccomEstimate {
  hostel: number;   // dorm bed per night, USD
  budget: number;   // budget private room per night, USD
  midrange: number; // mid-range hotel per night, USD
  currency: "USD";
}

// City name → nightly costs (USD)
const ACCOM_TABLE: Record<string, AccomEstimate> = {
  // Western Europe
  london:       { hostel: 30, budget: 90,  midrange: 180, currency: "USD" },
  paris:        { hostel: 30, budget: 90,  midrange: 180, currency: "USD" },
  amsterdam:    { hostel: 28, budget: 85,  midrange: 160, currency: "USD" },
  zurich:       { hostel: 40, budget: 120, midrange: 220, currency: "USD" },
  geneva:       { hostel: 40, budget: 120, midrange: 220, currency: "USD" },
  oslo:         { hostel: 35, budget: 110, midrange: 200, currency: "USD" },
  stockholm:    { hostel: 30, budget: 95,  midrange: 170, currency: "USD" },
  copenhagen:   { hostel: 30, budget: 95,  midrange: 170, currency: "USD" },
  helsinki:     { hostel: 28, budget: 85,  midrange: 150, currency: "USD" },
  dublin:       { hostel: 25, budget: 80,  midrange: 160, currency: "USD" },
  // Central / Southern Europe
  berlin:       { hostel: 18, budget: 60,  midrange: 120, currency: "USD" },
  munich:       { hostel: 22, budget: 75,  midrange: 140, currency: "USD" },
  frankfurt:    { hostel: 20, budget: 70,  midrange: 130, currency: "USD" },
  hamburg:      { hostel: 18, budget: 65,  midrange: 120, currency: "USD" },
  vienna:       { hostel: 20, budget: 65,  midrange: 130, currency: "USD" },
  brussels:     { hostel: 20, budget: 65,  midrange: 120, currency: "USD" },
  barcelona:    { hostel: 20, budget: 65,  midrange: 130, currency: "USD" },
  madrid:       { hostel: 18, budget: 60,  midrange: 120, currency: "USD" },
  lisbon:       { hostel: 18, budget: 55,  midrange: 110, currency: "USD" },
  porto:        { hostel: 15, budget: 50,  midrange: 100, currency: "USD" },
  rome:         { hostel: 20, budget: 70,  midrange: 140, currency: "USD" },
  milan:        { hostel: 22, budget: 75,  midrange: 150, currency: "USD" },
  florence:     { hostel: 20, budget: 65,  midrange: 130, currency: "USD" },
  venice:       { hostel: 25, budget: 80,  midrange: 160, currency: "USD" },
  prague:       { hostel: 12, budget: 40,  midrange: 90,  currency: "USD" },
  budapest:     { hostel: 12, budget: 38,  midrange: 85,  currency: "USD" },
  warsaw:       { hostel: 12, budget: 40,  midrange: 85,  currency: "USD" },
  krakow:       { hostel: 10, budget: 35,  midrange: 75,  currency: "USD" },
  athens:       { hostel: 15, budget: 50,  midrange: 100, currency: "USD" },
  dubrovnik:    { hostel: 18, budget: 60,  midrange: 130, currency: "USD" },
  split:        { hostel: 15, budget: 50,  midrange: 100, currency: "USD" },
  zagreb:       { hostel: 12, budget: 35,  midrange: 75,  currency: "USD" },
  belgrade:     { hostel: 10, budget: 30,  midrange: 65,  currency: "USD" },
  sofia:        { hostel: 8,  budget: 28,  midrange: 60,  currency: "USD" },
  bucharest:    { hostel: 10, budget: 32,  midrange: 70,  currency: "USD" },
  tallinn:      { hostel: 15, budget: 45,  midrange: 90,  currency: "USD" },
  riga:         { hostel: 12, budget: 38,  midrange: 75,  currency: "USD" },
  vilnius:      { hostel: 10, budget: 35,  midrange: 70,  currency: "USD" },
  // Middle East
  dubai:        { hostel: 25, budget: 80,  midrange: 180, currency: "USD" },
  istanbul:     { hostel: 12, budget: 40,  midrange: 90,  currency: "USD" },
  // Asia
  tokyo:        { hostel: 20, budget: 60,  midrange: 130, currency: "USD" },
  osaka:        { hostel: 18, budget: 55,  midrange: 110, currency: "USD" },
  kyoto:        { hostel: 20, budget: 60,  midrange: 120, currency: "USD" },
  seoul:        { hostel: 15, budget: 50,  midrange: 100, currency: "USD" },
  beijing:      { hostel: 10, budget: 35,  midrange: 80,  currency: "USD" },
  shanghai:     { hostel: 12, budget: 40,  midrange: 90,  currency: "USD" },
  bangkok:      { hostel: 8,  budget: 25,  midrange: 60,  currency: "USD" },
  "chiang mai": { hostel: 6,  budget: 18,  midrange: 45,  currency: "USD" },
  singapore:    { hostel: 20, budget: 70,  midrange: 160, currency: "USD" },
  "kuala lumpur":{ hostel: 8, budget: 25,  midrange: 60,  currency: "USD" },
  bali:         { hostel: 8,  budget: 22,  midrange: 55,  currency: "USD" },
  jakarta:      { hostel: 8,  budget: 25,  midrange: 60,  currency: "USD" },
  hanoi:        { hostel: 6,  budget: 18,  midrange: 45,  currency: "USD" },
  "ho chi minh city": { hostel: 6, budget: 18, midrange: 45, currency: "USD" },
  "hoi an":     { hostel: 5,  budget: 15,  midrange: 40,  currency: "USD" },
  "da nang":    { hostel: 6,  budget: 18,  midrange: 45,  currency: "USD" },
  "siem reap":  { hostel: 5,  budget: 12,  midrange: 35,  currency: "USD" },
  "phnom penh": { hostel: 5,  budget: 14,  midrange: 38,  currency: "USD" },
  manila:       { hostel: 8,  budget: 22,  midrange: 50,  currency: "USD" },
  delhi:        { hostel: 6,  budget: 20,  midrange: 55,  currency: "USD" },
  mumbai:       { hostel: 8,  budget: 25,  midrange: 65,  currency: "USD" },
  colombo:      { hostel: 6,  budget: 18,  midrange: 45,  currency: "USD" },
  // Americas
  "new york":   { hostel: 40, budget: 120, midrange: 250, currency: "USD" },
  "los angeles":{ hostel: 35, budget: 100, midrange: 200, currency: "USD" },
  chicago:      { hostel: 30, budget: 90,  midrange: 180, currency: "USD" },
  miami:        { hostel: 30, budget: 90,  midrange: 180, currency: "USD" },
  toronto:      { hostel: 30, budget: 90,  midrange: 170, currency: "USD" },
  montreal:     { hostel: 25, budget: 75,  midrange: 140, currency: "USD" },
  "mexico city":{ hostel: 10, budget: 30,  midrange: 70,  currency: "USD" },
  "buenos aires":{ hostel: 8, budget: 25,  midrange: 60,  currency: "USD" },
  "sao paulo":  { hostel: 10, budget: 30,  midrange: 70,  currency: "USD" },
  "rio de janeiro":{ hostel: 12, budget: 35, midrange: 80, currency: "USD" },
  // Africa / Oceania
  "cape town":  { hostel: 12, budget: 40,  midrange: 90,  currency: "USD" },
  nairobi:      { hostel: 10, budget: 30,  midrange: 70,  currency: "USD" },
  marrakech:    { hostel: 8,  budget: 25,  midrange: 60,  currency: "USD" },
  casablanca:   { hostel: 10, budget: 30,  midrange: 70,  currency: "USD" },
  // Oceania
  sydney:       { hostel: 30, budget: 90,  midrange: 180, currency: "USD" },
  melbourne:    { hostel: 28, budget: 85,  midrange: 170, currency: "USD" },
  auckland:     { hostel: 25, budget: 75,  midrange: 150, currency: "USD" },
  // Other
  reykjavik:    { hostel: 35, budget: 110, midrange: 220, currency: "USD" },
};

function normalise(city: string): string {
  return city.toLowerCase().trim();
}

/**
 * Returns nightly accommodation estimates for a city, or null if unknown.
 */
export function getAccomEstimate(city: string): AccomEstimate | null {
  return ACCOM_TABLE[normalise(city)] ?? null;
}
