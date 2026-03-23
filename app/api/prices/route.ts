import { NextRequest, NextResponse } from "next/server";
import { FlightOffer } from "@/lib/types";
import { lookupFlightPrices } from "@/lib/flightPrices";
import { summarizeGoogleFlightsError } from "@/lib/googleFlightsErrors";
import { normalizeFlightPreference } from "@/lib/flightPreferences";
import { resolveAirportCode } from "@/lib/airports";

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
 *   preference  — cheapest | fewest-stops | nonstop | fastest
 *   destinationAirport — optional override IATA code when a city needs a specific airport
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
  const preference = normalizeFlightPreference(searchParams.get("preference"));
  const destinationAirport = resolveAirportCode(destination, searchParams.get("destinationAirport")) ?? destination;

  if (!origin || !destination || !departure) {
    return NextResponse.json(
      { error: "Missing required params: origin, destination, departure" },
      { status: 400 }
    );
  }

  try {
    const result = await lookupFlightPrices({
      origin,
      destination: destinationAirport,
      departure,
      returnDate: returnDate || undefined,
      adults: parseInt(adults, 10),
      seat: seat as "economy" | "premium-economy" | "business" | "first",
      currency,
      preference,
    });

    const summarizedError = result.error ? summarizeGoogleFlightsError(result.error) : null;

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

    const status = summarizedError?.kind === "scrape_failure" && flights.length === 0 ? 502 : 200;

    return NextResponse.json({
      flights,
      currentPriceLevel: result.current_price_level,
      error: summarizedError?.message ?? null,
      errorType: summarizedError?.kind ?? null,
      fromCache: result.fromCache,
      preference,
      destinationAirport,
    }, { status });
  } catch (err) {
    console.error("Prices API error:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch prices";
    return NextResponse.json({ error: message, flights: [] }, { status: 500 });
  }
}
