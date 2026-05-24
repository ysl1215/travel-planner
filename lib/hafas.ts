/**
 * Live European train journey search using hafas-client.
 *
 * Uses Deutsche Bahn's HAFAS backend which covers most of Europe
 * (DB, ÖBB, SBB, SNCF, NS, SJ, and cross-border routes).
 * No API key required.
 */

import { TrainEstimate } from "./trainFares";

interface HafasJourney {
  legs: {
    origin?: { name?: string };
    destination?: { name?: string };
    departure?: string;
    arrival?: string;
    line?: { name?: string; product?: string };
  }[];
  price?: { amount?: number; currency?: string };
}

interface HafasLocation {
  type: string;
  id?: string;
  name?: string;
}

type ProfileName = "db" | "oebb" | "sncb";

const clientCache = new Map<ProfileName, Promise<any>>();

async function getClient(profileName: ProfileName = "db") {
  if (!clientCache.has(profileName)) {
    const promise = (async () => {
      const { createClient } = await import("hafas-client");
      const { profile } = await import(`hafas-client/p/${profileName}/index.js`);
      return createClient(profile, "travel-planner-ai");
    })();
    clientCache.set(profileName, promise);
  }
  return clientCache.get(profileName)!;
}

const FALLBACK_PROFILES: ProfileName[] = ["db", "oebb", "sncb"];

// Pre-mapped station IDs for common European cities (avoids fuzzy search network call)
const STATION_IDS: Record<string, string> = {
  "london": "8096109",       // London St Pancras
  "paris": "8796001",        // Paris Gare du Nord
  "amsterdam": "8400058",    // Amsterdam Centraal
  "brussels": "8814001",     // Bruxelles-Midi
  "berlin": "8011160",       // Berlin Hbf
  "hamburg": "8002549",      // Hamburg Hbf
  "munich": "8000261",       // München Hbf
  "frankfurt": "8000105",    // Frankfurt(Main)Hbf
  "cologne": "8000207",      // Köln Hbf
  "zurich": "8503000",       // Zürich HB
  "vienna": "8100003",       // Wien Hbf
  "prague": "5400014",       // Praha hl.n.
  "budapest": "5500017",     // Budapest-Keleti
  "warsaw": "5100028",       // Warszawa Centralna
  "copenhagen": "8600626",   // København H
  "stockholm": "7400001",    // Stockholm Central
  "milan": "8300046",        // Milano Centrale
  "rome": "8300263",         // Roma Termini
  "barcelona": "7100020",    // Barcelona Sants
  "madrid": "7160000",       // Madrid Puerta de Atocha
  "lisbon": "9400006",       // Lisboa Santa Apolónia
  "lyon": "8700012",         // Lyon Part-Dieu
  "marseille": "8700003",    // Marseille St-Charles
  "geneva": "8501008",       // Genève
  "salzburg": "8100002",     // Salzburg Hbf
  "florence": "8300151",     // Firenze SMN
  "venice": "8300120",       // Venezia S. Lucia
  "nice": "8700614",         // Nice-Ville
  "edinburgh": "9225000",    // Edinburgh Waverley
  "manchester": "9200124",   // Manchester Piccadilly
  // ÖBB network stations
  "innsbruck": "8100108",   // Innsbruck Hbf
  "graz": "8100173",        // Graz Hbf
  "linz": "8100013",        // Linz Hbf
  "ljubljana": "7943001",   // Ljubljana
  // SNCB network stations
  "antwerp": "8821006",     // Antwerpen-Centraal
  "ghent": "8892007",       // Gent-Sint-Pieters
  "lille": "8700011",       // Lille Flandres
  "strasbourg": "8700011",  // Strasbourg
};

async function findStation(client: any, city: string): Promise<string | null> {
  // Check pre-mapped stations first
  const preId = STATION_IDS[city.toLowerCase().trim()];
  if (preId) return preId;

  try {
    const locations: HafasLocation[] = await client.locations(city, {
      results: 1,
      fuzzy: true,
      stops: true,
      poi: false,
      addresses: false,
    });
    if (locations.length > 0 && locations[0].id) {
      return locations[0].id;
    }
  } catch {
    // Station not found
  }
  return null;
}

export interface LiveTrainResult {
  minPrice: number | null;
  currency: string;
  duration: string;
  departures: number;
  operator: string;
}

/**
 * Search for train journeys between two cities.
 * Tries multiple HAFAS profiles (DB, ÖBB, SNCB) for broader coverage.
 * Returns price and duration info, or null if no route found.
 */
export async function searchTrains(
  originCity: string,
  destinationCity: string,
  departureDate?: string
): Promise<LiveTrainResult | null> {
  for (const profileName of FALLBACK_PROFILES) {
    const result = await searchTrainsWithProfile(profileName, originCity, destinationCity, departureDate);
    if (result) return result;
  }
  return null;
}

async function searchTrainsWithProfile(
  profileName: ProfileName,
  originCity: string,
  destinationCity: string,
  departureDate?: string
): Promise<LiveTrainResult | null> {
  try {
    const client = await getClient(profileName);

    const [originId, destId] = await Promise.all([
      findStation(client, originCity),
      findStation(client, destinationCity),
    ]);

    if (!originId || !destId) return null;

    const when = departureDate ? new Date(departureDate) : new Date(Date.now() + 7 * 86_400_000);

    const results = await client.journeys(originId, destId, {
      results: 5,
      departure: when,
      transfers: 2,
      tickets: true,
      products: {
        nationalExpress: true,
        national: true,
        regionalExpress: true,
        regional: true,
        suburban: false,
        bus: false,
        ferry: false,
        subway: false,
        tram: false,
        taxi: false,
      },
    });

    const journeys: HafasJourney[] = results.journeys ?? [];
    if (journeys.length === 0) return null;

    const prices: number[] = [];
    const durations: number[] = [];
    const operators = new Set<string>();

    for (const j of journeys) {
      if (j.price?.amount) {
        prices.push(j.price.amount);
      }
      const firstLeg = j.legs[0];
      const lastLeg = j.legs[j.legs.length - 1];
      if (firstLeg?.departure && lastLeg?.arrival) {
        const dur = new Date(lastLeg.arrival).getTime() - new Date(firstLeg.departure).getTime();
        if (dur > 0) durations.push(dur);
      }
      for (const leg of j.legs) {
        if (leg.line?.name) operators.add(leg.line.name.split(" ")[0]);
      }
    }

    const minPrice = prices.length > 0 ? Math.min(...prices) : null;
    const shortestMs = durations.length > 0 ? Math.min(...durations) : null;
    const durationStr = shortestMs
      ? `${Math.floor(shortestMs / 3_600_000)}h ${Math.round((shortestMs % 3_600_000) / 60_000)}m`
      : "unknown";

    return {
      minPrice,
      currency: journeys[0]?.price?.currency ?? "EUR",
      duration: durationStr,
      departures: journeys.length,
      operator: [...operators].slice(0, 3).join(", ") || "Rail",
    };
  } catch (err) {
    if (profileName === "db") {
      console.warn(`hafas ${profileName} search failed, trying fallback:`, err instanceof Error ? err.message : err);
    }
    return null;
  }
}

/**
 * Convert live train result to the TrainEstimate interface expected by the frontend.
 */
export function toTrainEstimate(live: LiveTrainResult): TrainEstimate {
  const minFare = live.minPrice ?? 30;
  return {
    minFare,
    typicalFare: Math.round(minFare * 1.5),
    currency: "EUR",
    note: `Live: ${live.duration}, ${live.operator}`,
  };
}
