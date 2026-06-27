/**
 * Duffel Flight Search API client.
 *
 * Official flight API (NDC + GDS content). Free test access with a sandbox token;
 * live content requires an activated production token. Unlike the fast-flights
 * scraper, this is a stable, supported API — the durable primary flight source.
 *
 * Sign up at https://duffel.com to get an access token.
 * Docs: https://duffel.com/docs/api/offer-requests/create-offer-request
 *
 * Mirrors the lib/kiwi.ts contract exactly (searchFlights + isConfigured) so it
 * slots into the prices/route.ts provider-fallback chain.
 */

import { FlightOffer } from "@/lib/types";

const DUFFEL_BASE = "https://api.duffel.com";
const DUFFEL_VERSION = "v2";

function getAccessToken(): string | null {
  return process.env.DUFFEL_API_TOKEN?.trim() || null;
}

// Same params shape as KiwiSearchParams so the route can call either provider identically.
interface DuffelSearchParams {
  origin: string;
  destination: string;
  departure: string;
  returnDate?: string;
  adults: number;
  currency: string;       // Duffel returns the airline's currency; see note in mapping.
  flexDays?: number;      // Ignored — Duffel has no native flex-date search.
  seat?: "economy" | "premium-economy" | "business" | "first";
}

// Map our cabin labels to Duffel's cabin_class enum (note the underscore).
const CABIN_CLASS: Record<string, string> = {
  economy: "economy",
  "premium-economy": "premium_economy",
  business: "business",
  first: "first",
};

interface DuffelSegment {
  departing_at: string;
  arriving_at: string;
  duration: string; // ISO-8601, e.g. "PT2H26M"
  operating_carrier?: { name?: string };
  marketing_carrier?: { name?: string };
}

interface DuffelSlice {
  segments: DuffelSegment[];
}

interface DuffelOffer {
  id: string;
  total_amount: string;   // string, e.g. "45.00"
  total_currency: string; // ISO 4217, e.g. "GBP"
  owner?: { name?: string };
  slices: DuffelSlice[];
}

interface DuffelResponse {
  data: { offers: DuffelOffer[] };
}

export async function searchFlights(params: DuffelSearchParams): Promise<{
  flights: FlightOffer[];
  error: string | null;
}> {
  const token = getAccessToken();
  if (!token) {
    return { flights: [], error: "DUFFEL_API_TOKEN not configured" };
  }

  // One slice for one-way, two for round-trip.
  const slices: { origin: string; destination: string; departure_date: string }[] = [
    { origin: params.origin, destination: params.destination, departure_date: params.departure },
  ];
  if (params.returnDate) {
    slices.push({ origin: params.destination, destination: params.origin, departure_date: params.returnDate });
  }

  const body = {
    data: {
      slices,
      passengers: Array.from({ length: Math.max(1, params.adults) }, () => ({ type: "adult" })),
      cabin_class: CABIN_CLASS[params.seat ?? "economy"] ?? "economy",
    },
  };

  const url = `${DUFFEL_BASE}/air/offer_requests?return_offers=true`;

  let lastError: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Duffel-Version": DUFFEL_VERSION,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });

      if (res.status === 429) {
        lastError = "Duffel rate limit reached";
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        return { flights: [], error: `Duffel API error ${res.status}: ${text.slice(0, 200)}` };
      }

      const data: DuffelResponse = await res.json();
      const flights = mapDuffelOffers(data, params);
      return { flights, error: null };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Duffel fetch failed";
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }

  return { flights: [], error: lastError };
}

function mapDuffelOffers(data: DuffelResponse, params: DuffelSearchParams): FlightOffer[] {
  const offers = data.data?.offers ?? [];
  // Duffel does not pre-sort by price; sort ascending so isBest (idx 0) is the cheapest.
  const sorted = [...offers].sort((a, b) => parseFloat(a.total_amount) - parseFloat(b.total_amount));

  return sorted.slice(0, 10).map((offer, idx) => {
    const outbound = offer.slices[0];
    const segments = outbound?.segments ?? [];
    const first = segments[0];
    const last = segments[segments.length - 1];

    // Stops on the outbound slice = connections between segments.
    const stops = Math.max(0, segments.length - 1);

    // Airline: prefer the offer owner, else the marketing carrier of the first segment.
    const airline =
      offer.owner?.name ||
      first?.marketing_carrier?.name ||
      first?.operating_carrier?.name ||
      "Unknown";

    return {
      airline,
      origin: params.origin,
      destination: params.destination,
      departureDate: params.departure,
      returnDate: params.returnDate ?? "",
      departureTime: extractTime(first?.departing_at),
      arrivalTime: extractTime(last?.arriving_at),
      price: parseFloat(offer.total_amount) || 0,
      currency: offer.total_currency,
      duration: formatDuration(sumDurations(segments)),
      stops,
      isBest: idx === 0,
    };
  });
}

/** "2026-06-13T16:38:02" → "16:38". */
function extractTime(datetime: string | undefined): string {
  if (!datetime) return "";
  const match = datetime.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

/** Parse an ISO-8601 duration ("PT2H26M") into total minutes. */
function parseIsoDuration(iso: string | undefined): number {
  if (!iso) return 0;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] ?? "0", 10);
  const mins = parseInt(match[2] ?? "0", 10);
  return hours * 60 + mins;
}

/** Total elapsed minutes across an outbound slice's segments (flight time only). */
function sumDurations(segments: DuffelSegment[]): number {
  return segments.reduce((total, seg) => total + parseIsoDuration(seg.duration), 0);
}

/** Minutes → "Xh Ym" to match the Kiwi provider's duration format. */
function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins}m`;
}

export function isConfigured(): boolean {
  return !!getAccessToken();
}
