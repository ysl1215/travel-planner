import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { FlightOffer } from "@/lib/types";
import { searchFlights as kiwiSearch, isConfigured as kiwiConfigured } from "@/lib/kiwi";

// ─── In-memory price cache (TTL: 20 minutes) ────────────────────────────────

const CACHE_TTL_MS = 20 * 60 * 1000;

interface CacheEntry {
  data: { flights: FlightOffer[]; currentPriceLevel: string; error: string | null };
  timestamp: number;
}

const priceCache = new Map<string, CacheEntry>();

function getCacheKey(params: Record<string, string>): string {
  return `${params.origin}-${params.destination}-${params.departure}-${params.returnDate || ""}-${params.adults}-${params.seat}`;
}

function getCached(key: string): CacheEntry["data"] | null {
  const entry = priceCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    priceCache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * GET /api/prices
 *
 * Fetches live flight prices. Provider priority:
 *   1. Kiwi.com Tequila API (if KIWI_API_KEY is set)
 *   2. fast-flights Python scraper (Google Flights, if Python + fast-flights installed)
 *
 * Required query params:
 *   origin      — IATA airport code, e.g. LHR
 *   destination — IATA airport code, e.g. LIS
 *   departure   — YYYY-MM-DD
 *
 * Optional:
 *   return      — YYYY-MM-DD (omit for one-way)
 *   adults      — integer, default 1
 *   seat        — economy | premium-economy | business | first
 *   currency    — e.g. USD (default)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const origin = searchParams.get("origin")?.toUpperCase() ?? "";
  const destination = searchParams.get("destination")?.toUpperCase() ?? "";
  const departure = searchParams.get("departure") ?? "";
  const returnDate = searchParams.get("return") ?? "";
  const adults = searchParams.get("adults") ?? "1";
  const seat = searchParams.get("seat") ?? "economy";
  const currency = searchParams.get("currency") ?? "USD";
  const flexDays = parseInt(searchParams.get("flexDays") ?? "0", 10);

  if (!origin || !destination || !departure) {
    return NextResponse.json(
      { error: "Missing required params: origin, destination, departure" },
      { status: 400 }
    );
  }

  // Check cache first
  const cacheKey = getCacheKey({ origin, destination, departure, returnDate, adults, seat });
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  // Try Kiwi first, then fall back to fast-flights
  const result = await fetchWithFallback({
    origin,
    destination,
    departure,
    returnDate: returnDate || undefined,
    adults: parseInt(adults, 10),
    seat: seat as "economy" | "premium-economy" | "business" | "first",
    currency,
    flexDays,
  });

  if (result.error && !result.flights.length) {
    return NextResponse.json(
      { error: result.error, flights: [] },
      { status: 502 }
    );
  }

  const responseData = {
    flights: result.flights,
    currentPriceLevel: result.currentPriceLevel,
    error: result.error ?? null,
  };

  // Cache successful results
  if (result.flights.length > 0) {
    priceCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
  }

  return NextResponse.json(responseData);
}

// ─── Fallback orchestration ─────────────────────────────────────────────────

interface SearchParams {
  origin: string;
  destination: string;
  departure: string;
  returnDate?: string;
  adults: number;
  seat: "economy" | "premium-economy" | "business" | "first";
  currency: string;
  flexDays?: number;
}

interface SearchResult {
  flights: FlightOffer[];
  currentPriceLevel: string;
  error: string | null;
}

async function fetchWithFallback(params: SearchParams): Promise<SearchResult> {
  // 1. Try Kiwi.com Tequila API
  if (kiwiConfigured()) {
    try {
      const kiwi = await kiwiSearch({
        origin: params.origin,
        destination: params.destination,
        departure: params.departure,
        returnDate: params.returnDate,
        adults: params.adults,
        currency: params.currency,
        flexDays: params.flexDays,
      });

      if (kiwi.flights.length > 0) {
        return {
          flights: kiwi.flights,
          currentPriceLevel: inferPriceLevel(kiwi.flights),
          error: null,
        };
      }

      // Kiwi returned no results — fall through to fast-flights
      console.warn("Kiwi returned no flights, trying fast-flights fallback:", kiwi.error);
    } catch (err) {
      console.warn("Kiwi search failed, trying fast-flights fallback:", err);
    }
  }

  // 2. Fallback: fast-flights Python scraper
  try {
    const result = await runFlightScript(params);

    const flights: FlightOffer[] = result.flights.map((f) => ({
      airline: f.airline,
      origin: f.origin,
      destination: f.destination,
      departureDate: f.departure_date,
      returnDate: f.return_date ?? "",
      departureTime: f.departure_time,
      arrivalTime: f.arrival_time,
      price: f.price,
      currency: f.currency,
      duration: f.duration,
      stops: typeof f.stops === "number" ? f.stops : 0,
      isBest: f.is_best ?? false,
    }));

    return {
      flights,
      currentPriceLevel: result.current_price_level,
      error: result.error,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch prices";
    return { flights: [], currentPriceLevel: "", error: message };
  }
}

function inferPriceLevel(flights: FlightOffer[]): string {
  // Simple heuristic: compare cheapest to median
  if (flights.length < 3) return "";
  const prices = flights.map((f) => f.price).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)];
  const cheapest = prices[0];
  const ratio = cheapest / median;
  if (ratio < 0.7) return "low";
  if (ratio > 0.95) return "high";
  return "typical";
}

// ─── Python subprocess helper (fast-flights fallback) ───────────────────────

interface ScriptFlight {
  airline: string;
  origin: string;
  destination: string;
  departure_date: string;
  return_date: string | null;
  departure_time: string;
  arrival_time: string;
  duration: string;
  stops: number | string;
  delay: string | null;
  price: number;
  currency: string;
  is_best: boolean;
}

interface ScriptResult {
  flights: ScriptFlight[];
  current_price_level: string;
  error: string | null;
}

function runFlightScript(params: SearchParams): Promise<ScriptResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scripts", "google_flights.py");

    const pyArgs = [
      scriptPath,
      "--origin", params.origin,
      "--destination", params.destination,
      "--departure", params.departure,
      "--adults", String(params.adults),
      "--seat", params.seat,
      "--currency", params.currency,
    ];

    if (params.returnDate) {
      pyArgs.push("--return", params.returnDate);
    }

    const py = spawn("python3", pyArgs, {
      timeout: 30_000,
    });

    let stdout = "";
    let stderr = "";

    py.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    py.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    py.on("close", (code) => {
      if (!stdout.trim()) {
        reject(
          new Error(
            `google_flights.py produced no output (exit ${code}). ` +
            `Are Python 3 and fast-flights installed? stderr: ${stderr.slice(0, 200)}`
          )
        );
        return;
      }

      try {
        const parsed: ScriptResult = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch {
        reject(new Error(`Failed to parse script output as JSON: ${stdout.slice(0, 200)}`));
      }
    });

    py.on("error", (err) => {
      reject(new Error(`Failed to spawn python3: ${err.message}. Make sure Python 3 is installed.`));
    });
  });
}
