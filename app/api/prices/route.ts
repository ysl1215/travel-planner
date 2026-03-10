import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { FlightOffer } from "@/lib/types";

/**
 * GET /api/prices
 *
 * Scrapes live flight prices from Google Flights using the
 * fast-flights Python library (https://github.com/AWeirdDev/flights).
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
 *
 * Prerequisites (server-side only):
 *   pip install fast-flights
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

  if (!origin || !destination || !departure) {
    return NextResponse.json(
      { error: "Missing required params: origin, destination, departure" },
      { status: 400 }
    );
  }

  try {
    const result = await runFlightScript({
      origin,
      destination,
      departure,
      returnDate: returnDate || undefined,
      adults: parseInt(adults, 10),
      seat: seat as "economy" | "premium-economy" | "business" | "first",
      currency,
    });

    if (result.error && !result.flights.length) {
      return NextResponse.json(
        { error: result.error, flights: [] },
        { status: 502 }
      );
    }

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

    return NextResponse.json({
      flights,
      currentPriceLevel: result.current_price_level,
      error: result.error ?? null,
    });
  } catch (err) {
    console.error("Prices API error:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch prices";
    return NextResponse.json({ error: message, flights: [] }, { status: 500 });
  }
}

// ─── Python subprocess helper ────────────────────────────────────────────────

interface ScriptArgs {
  origin: string;
  destination: string;
  departure: string;
  returnDate?: string;
  adults: number;
  seat: "economy" | "premium-economy" | "business" | "first";
  currency: string;
}

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

function runFlightScript(args: ScriptArgs): Promise<ScriptResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scripts", "google_flights.py");

    const pyArgs = [
      scriptPath,
      "--origin", args.origin,
      "--destination", args.destination,
      "--departure", args.departure,
      "--adults", String(args.adults),
      "--seat", args.seat,
      "--currency", args.currency,
    ];

    if (args.returnDate) {
      pyArgs.push("--return", args.returnDate);
    }

    const py = spawn("python3", pyArgs, {
      timeout: 15_000, // 15-second timeout
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
