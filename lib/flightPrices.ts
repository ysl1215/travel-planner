import { spawn } from "child_process";
import path from "path";
import { normalizeFlightPreference } from "./flightPreferences";
import { incrementMetric } from "./metrics";

export interface FlightSearchArgs {
  origin: string;
  destination: string;
  departure: string;
  returnDate?: string;
  adults: number;
  seat: "economy" | "premium-economy" | "business" | "first";
  currency: string;
  preference?: "cheapest" | "fewest-stops" | "nonstop" | "fastest";
  fetchMode?: "common" | "fallback" | "force-fallback" | "local";
}

export interface ScriptFlight {
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

export interface ScriptResult {
  flights: ScriptFlight[];
  current_price_level: string;
  error: string | null;
}

export interface FlightPriceLookupResult extends ScriptResult {
  fromCache: boolean;
}

export interface FlightTimeLookupResult {
  hours: number | null;
  verifiedThroughLiveSearch: boolean;
  fromCache: boolean;
}

type CachedFlightTime = {
  hours: number | null;
  verifiedThroughLiveSearch: boolean;
  expiresAt: number;
};

type CachedFlightPrice = {
  result: ScriptResult;
  expiresAt: number;
};

const FLIGHT_TIME_CACHE_TTL_MS = Number(process.env.FLIGHT_TIME_CACHE_TTL_MS ?? String(24 * 60 * 60 * 1000));
const FLIGHT_PRICE_CACHE_TTL_MS = Number(process.env.FLIGHT_PRICE_CACHE_TTL_MS ?? String(15 * 60 * 1000));

declare global {
  var __flightTimeCache: Map<string, CachedFlightTime> | undefined;
  var __flightPriceCache: Map<string, CachedFlightPrice> | undefined;
}

const flightTimeCache = globalThis.__flightTimeCache ?? new Map<string, CachedFlightTime>();
globalThis.__flightTimeCache = flightTimeCache;
const flightPriceCache = globalThis.__flightPriceCache ?? new Map<string, CachedFlightPrice>();
globalThis.__flightPriceCache = flightPriceCache;

function parseDurationToHours(duration: string): number | null {
  const cleaned = duration.toLowerCase().trim();
  if (!cleaned) return null;

  const hourMatches = [...cleaned.matchAll(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)/g)];
  const minuteMatches = [...cleaned.matchAll(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)/g)];

  if (hourMatches.length === 0 && minuteMatches.length === 0) {
    const numeric = Number(cleaned);
    return Number.isFinite(numeric) ? numeric : null;
  }

  const hours = hourMatches.reduce((sum, match) => sum + Number(match[1]), 0);
  const minutes = minuteMatches.reduce((sum, match) => sum + Number(match[1]), 0);
  return hours + minutes / 60;
}

function compareFlightsByPreference(
  a: ScriptFlight,
  b: ScriptFlight,
  preference: ReturnType<typeof normalizeFlightPreference>
): number {
  const aStops = typeof a.stops === "number" ? a.stops : Number.POSITIVE_INFINITY;
  const bStops = typeof b.stops === "number" ? b.stops : Number.POSITIVE_INFINITY;
  const aPrice = Number.isFinite(a.price) ? a.price : Number.POSITIVE_INFINITY;
  const bPrice = Number.isFinite(b.price) ? b.price : Number.POSITIVE_INFINITY;
  const aDuration = parseDurationToHours(a.duration) ?? Number.POSITIVE_INFINITY;
  const bDuration = parseDurationToHours(b.duration) ?? Number.POSITIVE_INFINITY;

  switch (preference) {
    case "fewest-stops":
      return aStops - bStops || aPrice - bPrice || aDuration - bDuration;
    case "nonstop":
      return aStops - bStops || aPrice - bPrice || aDuration - bDuration;
    case "fastest":
      return aDuration - bDuration || aPrice - bPrice || aStops - bStops;
    case "cheapest":
    default:
      return aPrice - bPrice || aStops - bStops || aDuration - bDuration;
  }
}

export function applyFlightPreference(
  result: ScriptResult,
  preference?: FlightSearchArgs["preference"]
): ScriptResult {
  const normalizedPreference = normalizeFlightPreference(preference ?? null);
  const flights =
    normalizedPreference === "nonstop" && result.flights.some((flight) => (typeof flight.stops === "number" ? flight.stops : Number.POSITIVE_INFINITY) === 0)
      ? result.flights.filter((flight) => (typeof flight.stops === "number" ? flight.stops : Number.POSITIVE_INFINITY) === 0)
      : result.flights;

  const sortedFlights = [...flights].sort((a, b) => compareFlightsByPreference(a, b, normalizedPreference));

  return {
    ...result,
    flights: sortedFlights.map((flight, index) => ({
      ...flight,
      is_best: index === 0,
    })),
  };
}

function buildFlightTimeCacheKey(args: FlightSearchArgs) {
  return [
    args.origin.trim().toUpperCase(),
    args.destination.trim().toUpperCase(),
    args.departure.trim(),
    args.returnDate?.trim() ?? "",
  ].join("|");
}

function buildFlightPriceCacheKey(args: FlightSearchArgs) {
  return [
    args.origin.trim().toUpperCase(),
    args.destination.trim().toUpperCase(),
    args.departure.trim(),
    args.returnDate?.trim() ?? "",
    String(args.adults),
    args.seat,
    args.currency.trim().toUpperCase(),
  ].join("|");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableGoogleFlightsError(error: string | null): boolean {
  if (!error) return false;

  const lower = error.toLowerCase();
  return (
    lower.includes("temporarily returned an unusable response") ||
    lower.includes("skip to main content") ||
    lower.includes("accessibility feedback") ||
    lower.includes("loading results") ||
    lower.includes("flight search") ||
    lower.includes("no flights found") ||
    lower.includes("failed to parse") ||
    lower.includes("timeout") ||
    lower.includes("rate limit") ||
    lower.includes("captcha")
  );
}

export function getShortestFlightHours(result: ScriptResult): number | null {
  const durations = result.flights
    .map((flight) => parseDurationToHours(flight.duration))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (!durations.length) return null;
  return Math.min(...durations);
}

export function getCachedFlightHours(args: FlightSearchArgs): number | null {
  const cacheKey = buildFlightTimeCacheKey(args);
  const cached = flightTimeCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    flightTimeCache.delete(cacheKey);
    return null;
  }

  return cached.hours;
}

export async function runFlightScript(args: FlightSearchArgs): Promise<ScriptResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scripts", "google_flights.py");

    const pyArgs = [
      scriptPath,
      "--origin",
      args.origin,
      "--destination",
      args.destination,
      "--departure",
      args.departure,
      "--adults",
      String(args.adults),
      "--seat",
      args.seat,
      "--currency",
      args.currency,
    ];

    if (args.fetchMode) {
      pyArgs.push("--fetch-mode", args.fetchMode);
    }

    if (args.returnDate) {
      pyArgs.push("--return", args.returnDate);
    }

    const py = spawn("python3", pyArgs, {
      timeout: 15_000,
    });

    let stdout = "";
    let stderr = "";

    py.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    py.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

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

async function runFlightScriptWithMode(args: FlightSearchArgs, fetchMode: NonNullable<FlightSearchArgs["fetchMode"]>) {
  return runFlightScript({ ...args, fetchMode });
}

export function getCachedFlightPrices(args: FlightSearchArgs): ScriptResult | null {
  const cacheKey = buildFlightPriceCacheKey(args);
  const cached = flightPriceCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    flightPriceCache.delete(cacheKey);
    return null;
  }

  return cached.result;
}

export async function estimateFlightHours(args: FlightSearchArgs): Promise<number | null> {
  const lookup = await lookupFlightHours(args);
  return lookup.hours;
}

export async function lookupFlightHours(args: FlightSearchArgs): Promise<FlightTimeLookupResult> {
  // Testing helper: force lookup failures when SIMULATE_FLIGHT_LOOKUP_FAILURE=true
  if (process.env.SIMULATE_FLIGHT_LOOKUP_FAILURE === "true") {
    console.warn("SIMULATE_FLIGHT_LOOKUP_FAILURE enabled: forcing lookup failure");
    incrementMetric('lookupFailures');
    return {
      hours: null,
      verifiedThroughLiveSearch: false,
      fromCache: false,
    };
  }

  const cacheKey = buildFlightTimeCacheKey(args);
  const cached = flightTimeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      hours: cached.hours,
      verifiedThroughLiveSearch: true,
      fromCache: true,
    };
  }

  if (cached) {
    flightTimeCache.delete(cacheKey);
  }

  try {
    const fetchModes: NonNullable<FlightSearchArgs["fetchMode"]>[] = ["common", "fallback", "force-fallback", "local"];
    let hours: number | null = null;
    let verifiedThroughLiveSearch = false;

    for (const fetchMode of fetchModes) {
      const result = await runFlightScriptWithMode(args, fetchMode);
      const candidateHours = getShortestFlightHours(result);
      verifiedThroughLiveSearch = verifiedThroughLiveSearch || result.flights.length > 0;

      if (candidateHours !== null) {
        hours = candidateHours;
        break;
      }
    }

    if (hours !== null || verifiedThroughLiveSearch) {
      flightTimeCache.set(cacheKey, {
        hours,
        verifiedThroughLiveSearch,
        expiresAt: Date.now() + FLIGHT_TIME_CACHE_TTL_MS,
      });
    }

    return {
      hours,
      verifiedThroughLiveSearch,
      fromCache: false,
    };
  } catch (err) {
    console.warn("lookupFlightHours error:", err instanceof Error ? err.message : String(err));
    incrementMetric('lookupFailures');
    return {
      hours: null,
      verifiedThroughLiveSearch: false,
      fromCache: false,
    };
  }
}

export async function lookupFlightPrices(args: FlightSearchArgs): Promise<FlightPriceLookupResult> {
  const preference = normalizeFlightPreference(args.preference ?? null);
  const cacheKey = buildFlightPriceCacheKey(args);
  const cached = flightPriceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    const adjusted = applyFlightPreference(cached.result, preference);
    return {
      ...adjusted,
      fromCache: true,
    };
  }

  if (cached) {
    flightPriceCache.delete(cacheKey);
  }

  const fetchModes: NonNullable<FlightSearchArgs["fetchMode"]>[] = ["common", "fallback", "force-fallback", "local"];
  let lastResult: ScriptResult | null = null;

  for (let index = 0; index < fetchModes.length; index++) {
    const fetchMode = fetchModes[index];
    const result = await runFlightScriptWithMode(args, fetchMode);
    lastResult = result;

      if (result.flights.length > 0) {
        flightPriceCache.set(cacheKey, {
          result,
          expiresAt: Date.now() + FLIGHT_PRICE_CACHE_TTL_MS,
        });
        const adjusted = applyFlightPreference(result, preference);
        return {
          ...adjusted,
          fromCache: false,
        };
      }

    if (!isRetryableGoogleFlightsError(result.error)) {
      break;
    }

    if (index < fetchModes.length - 1) {
      await sleep(250 * (index + 1));
    }
  }

  return {
    ...applyFlightPreference(
      {
        flights: lastResult?.flights ?? [],
        current_price_level: lastResult?.current_price_level ?? "",
        error: lastResult?.error ?? null,
      },
      preference
    ),
    fromCache: false,
  };
}
