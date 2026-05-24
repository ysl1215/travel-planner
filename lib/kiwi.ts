/**
 * Kiwi.com Tequila Flight Search API client.
 *
 * Free tier: 100 searches/month (no credit card required).
 * Sign up at https://tequila.kiwi.com to get an API key.
 *
 * Docs: https://tequila.kiwi.com/portal/docs/tequila_api/search_api
 */

import { FlightOffer } from "@/lib/types";

const TEQUILA_BASE = "https://api.tequila.kiwi.com/v2";

function getApiKey(): string | null {
  return process.env.KIWI_API_KEY?.trim() || null;
}

interface KiwiSearchParams {
  origin: string;
  destination: string;
  departure: string;
  returnDate?: string;
  adults: number;
  currency: string;
  flexDays?: number;
}

interface KiwiRoute {
  airline: string;
  local_departure: string;
  local_arrival: string;
  flyFrom: string;
  flyTo: string;
}

interface KiwiResult {
  id: string;
  price: number;
  airlines: string[];
  route: KiwiRoute[];
  duration: { departure: number; return: number; total: number };
  flyFrom: string;
  flyTo: string;
  local_departure: string;
  local_arrival: string;
  deep_link: string;
}

interface KiwiResponse {
  data: KiwiResult[];
  currency: string;
}

export async function searchFlights(params: KiwiSearchParams): Promise<{
  flights: FlightOffer[];
  error: string | null;
}> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { flights: [], error: "KIWI_API_KEY not configured" };
  }

  const flex = params.flexDays ?? 0;
  const departureFrom = flex > 0 ? offsetDate(params.departure, -flex) : params.departure;
  const departureTo = flex > 0 ? offsetDate(params.departure, flex) : params.departure;

  const query = new URLSearchParams({
    fly_from: params.origin,
    fly_to: params.destination,
    date_from: formatDate(departureFrom),
    date_to: formatDate(departureTo),
    adults: String(params.adults),
    curr: params.currency,
    limit: "10",
    sort: "price",
    flight_type: params.returnDate ? "round" : "oneway",
  });

  if (params.returnDate) {
    const returnFrom = flex > 0 ? offsetDate(params.returnDate, -flex) : params.returnDate;
    const returnTo = flex > 0 ? offsetDate(params.returnDate, flex) : params.returnDate;
    query.set("return_from", formatDate(returnFrom));
    query.set("return_to", formatDate(returnTo));
  }

  const url = `${TEQUILA_BASE}/search?${query}`;

  let lastError: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { apikey: apiKey },
        signal: AbortSignal.timeout(15_000),
      });

      if (res.status === 429) {
        lastError = "Kiwi rate limit reached";
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        return { flights: [], error: `Kiwi API error ${res.status}: ${text.slice(0, 200)}` };
      }

      const data: KiwiResponse = await res.json();
      const flights = mapKiwiResults(data, params);
      return { flights, error: null };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Kiwi fetch failed";
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }

  return { flights: [], error: lastError };
}

function mapKiwiResults(data: KiwiResponse, params: KiwiSearchParams): FlightOffer[] {
  return data.data.map((result, idx) => {
    const outbound = result.route.filter((r) => r.flyFrom === params.origin || result.route.indexOf(r) < result.route.length / 2);
    const stops = Math.max(0, outbound.length - 1);
    const totalMinutes = result.duration.departure;
    const hours = Math.floor(totalMinutes / 3600);
    const mins = Math.floor((totalMinutes % 3600) / 60);

    return {
      airline: result.airlines.join(", "),
      origin: params.origin,
      destination: params.destination,
      departureDate: params.departure,
      returnDate: params.returnDate ?? "",
      departureTime: extractTime(result.local_departure),
      arrivalTime: extractTime(result.local_arrival),
      price: result.price,
      currency: data.currency,
      duration: `${hours}h ${mins}m`,
      stops,
      isBest: idx === 0,
    };
  });
}

function formatDate(isoDate: string): string {
  // Kiwi expects dd/mm/yyyy
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function extractTime(isoDatetime: string): string {
  // "2026-06-14T08:30:00.000Z" → "08:30"
  const match = isoDatetime.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

function offsetDate(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isConfigured(): boolean {
  return !!getApiKey();
}
