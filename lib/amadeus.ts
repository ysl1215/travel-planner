/**
 * Amadeus Hotel Search API client.
 *
 * Free tier: 2,000 calls/month (test environment, realistic cached data).
 * Sign up at https://developers.amadeus.com to get client ID + secret.
 *
 * Docs: https://developers.amadeus.com/self-service/category/hotels
 */

import { AccomEstimate } from "./accomEstimates";

const AMADEUS_BASE_TEST = "https://test.api.amadeus.com";
const AMADEUS_BASE_PROD = "https://api.amadeus.com";

function getCredentials(): { clientId: string; clientSecret: string; base: string } | null {
  const clientId = process.env.AMADEUS_CLIENT_ID?.trim();
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  // Use production endpoint if AMADEUS_ENV=production, otherwise test
  const isProd = process.env.AMADEUS_ENV?.toLowerCase() === "production";
  return { clientId, clientSecret, base: isProd ? AMADEUS_BASE_PROD : AMADEUS_BASE_TEST };
}

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(creds: { clientId: string; clientSecret: string; base: string }): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const res = await fetch(`${creds.base}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Amadeus auth failed: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

interface HotelOffer {
  hotel: {
    name: string;
    rating?: string;
    cityCode?: string;
  };
  offers: {
    price: {
      total: string;
      currency: string;
    };
    room?: {
      type?: string;
      description?: { text?: string };
    };
  }[];
}

export interface LiveHotelResult {
  cheapest: number;
  median: number;
  expensive: number;
  currency: string;
  sampleCount: number;
}

// Cache hotel IDs per city (rarely changes — cache for 24 hours)
const hotelIdCache = new Map<string, { ids: string[]; timestamp: number }>();
const HOTEL_ID_CACHE_TTL = 24 * 60 * 60 * 1000;

async function getHotelIdsForCity(creds: { clientId: string; clientSecret: string; base: string }, cityCode: string, token: string): Promise<string[]> {
  const key = cityCode.toUpperCase();
  const cached = hotelIdCache.get(key);
  if (cached && Date.now() - cached.timestamp < HOTEL_ID_CACHE_TTL) {
    return cached.ids;
  }

  const listParams = new URLSearchParams({
    cityCode: key,
    radius: "20",
    radiusUnit: "KM",
    hotelSource: "ALL",
  });

  const listRes = await fetch(
    `${creds.base}/v1/reference-data/locations/hotels/by-city?${listParams}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    }
  );

  if (!listRes.ok) {
    if (listRes.status === 429) return [];
    throw new Error(`Hotel list failed: ${listRes.status}`);
  }

  const listData = await listRes.json();
  const ids: string[] = (listData.data ?? [])
    .slice(0, 20)
    .map((h: any) => h.hotelId)
    .filter(Boolean);

  hotelIdCache.set(key, { ids, timestamp: Date.now() });
  return ids;
}

/**
 * Search for hotel prices in a city for given dates.
 * Returns price tiers, or null if unavailable.
 */
export async function searchHotels(
  cityCode: string,
  checkInDate: string,
  checkOutDate: string,
  adults: number = 1
): Promise<LiveHotelResult | null> {
  const creds = getCredentials();
  if (!creds) return null;

  try {
    const token = await getAccessToken(creds);

    const hotelIds = await getHotelIdsForCity(creds, cityCode, token);
    if (hotelIds.length === 0) return null;

    // Step 2: Get offers for those hotels
    const offersParams = new URLSearchParams({
      hotelIds: hotelIds.join(","),
      checkInDate,
      checkOutDate,
      adults: String(adults),
      currency: "USD",
      bestRateOnly: "true",
    });

    const offersRes = await fetch(
      `${creds.base}/v3/shopping/hotel-offers?${offersParams}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      }
    );

    if (!offersRes.ok) {
      if (offersRes.status === 429) return null;
      throw new Error(`Hotel offers failed: ${offersRes.status}`);
    }

    const offersData = await offersRes.json();
    const hotels: HotelOffer[] = offersData.data ?? [];

    // Extract all nightly prices
    const nights = Math.max(1, Math.round(
      (new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / 86_400_000
    ));

    const nightlyPrices: number[] = [];
    let currency = "USD";

    for (const hotel of hotels) {
      for (const offer of hotel.offers) {
        const total = parseFloat(offer.price.total);
        if (total > 0) {
          nightlyPrices.push(total / nights);
          currency = offer.price.currency;
        }
      }
    }

    if (nightlyPrices.length === 0) return null;

    nightlyPrices.sort((a, b) => a - b);
    const cheapest = nightlyPrices[0];
    const expensive = nightlyPrices[nightlyPrices.length - 1];
    const median = nightlyPrices[Math.floor(nightlyPrices.length / 2)];

    return {
      cheapest: Math.round(cheapest),
      median: Math.round(median),
      expensive: Math.round(expensive),
      currency,
      sampleCount: nightlyPrices.length,
    };
  } catch (err) {
    console.warn("Amadeus hotel search failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Convert live hotel result to the AccomEstimate interface expected by the frontend.
 */
export function toAccomEstimate(live: LiveHotelResult): AccomEstimate {
  return {
    hostel: Math.round(live.cheapest * 0.4),
    budget: live.cheapest,
    midrange: live.median,
    currency: "USD",
  };
}

export function isConfigured(): boolean {
  return !!getCredentials();
}

// Common IATA city codes for hotel search
const CITY_TO_IATA: Record<string, string> = {
  "london": "LON", "paris": "PAR", "amsterdam": "AMS", "berlin": "BER",
  "munich": "MUC", "frankfurt": "FRA", "rome": "ROM", "milan": "MIL",
  "barcelona": "BCN", "madrid": "MAD", "lisbon": "LIS", "vienna": "VIE",
  "zurich": "ZRH", "prague": "PRG", "budapest": "BUD", "warsaw": "WAW",
  "copenhagen": "CPH", "stockholm": "STO", "oslo": "OSL", "helsinki": "HEL",
  "dublin": "DUB", "brussels": "BRU", "athens": "ATH",
  "istanbul": "IST", "dubai": "DXB", "cairo": "CAI",
  "tokyo": "TYO", "osaka": "OSA", "seoul": "SEL", "beijing": "BJS",
  "shanghai": "SHA", "hong kong": "HKG", "singapore": "SIN",
  "bangkok": "BKK", "kuala lumpur": "KUL", "hanoi": "HAN",
  "ho chi minh city": "SGN", "bali": "DPS", "jakarta": "JKT",
  "mumbai": "BOM", "delhi": "DEL",
  "new york": "NYC", "los angeles": "LAX", "chicago": "CHI",
  "miami": "MIA", "toronto": "YTO", "montreal": "YMQ",
  "mexico city": "MEX", "sao paulo": "SAO", "buenos aires": "BUE",
  "sydney": "SYD", "melbourne": "MEL", "auckland": "AKL",
  "cape town": "CPT", "nairobi": "NBO", "johannesburg": "JNB",
};

export function cityToIataCode(city: string): string | null {
  return CITY_TO_IATA[city.toLowerCase().trim()] ?? null;
}
