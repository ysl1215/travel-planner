#!/usr/bin/env python3
"""
Google Flights price scraper via fast-flights.

Usage:
    python google_flights.py \
        --origin LHR \
        --destination LIS \
        --departure 2025-06-14 \
        [--return 2025-06-21] \
        [--adults 2] \
        [--seat economy] \
        [--currency USD]

Outputs a JSON object to stdout:
    {
      "flights": [...],
      "current_price_level": "low|typical|high",
      "error": null
    }

Install requirements:
    pip install fast-flights
"""

import argparse
import json
import sys
import re


def summarize_error_message(message: str) -> str:
    cleaned = re.sub(r"\s+", " ", message).strip()
    if not cleaned:
        return "Google Flights could not return results right now."

    lower = cleaned.lower()
    no_flights = "no flights found" in lower
    htmlish = (
        "<html" in lower
        or "<!doctype" in lower
        or "skip to main content" in lower
        or "accessibility feedback" in lower
        or "loading results" in lower
        or "flight search" in lower
    )

    if no_flights and not htmlish:
        return "No flights found for these dates."

    if no_flights or htmlish:
        return "Google Flights temporarily returned an unusable response. Try again later or change the dates."

    if len(cleaned) > 220:
        return cleaned[:217] + "..."

    return cleaned

def main():
    parser = argparse.ArgumentParser(description="Scrape Google Flights via fast-flights")
    parser.add_argument("--origin",      required=True,  help="Origin IATA airport code, e.g. LHR")
    parser.add_argument("--destination", required=True,  help="Destination IATA airport code, e.g. LIS")
    parser.add_argument("--departure",   required=True,  help="Departure date YYYY-MM-DD")
    parser.add_argument("--return",      dest="return_date", default=None, help="Return date YYYY-MM-DD (omit for one-way)")
    parser.add_argument("--adults",      type=int, default=1, help="Number of adult passengers")
    parser.add_argument("--seat",        default="economy",
                        choices=["economy", "premium-economy", "business", "first"])
    parser.add_argument("--currency",    default="USD", help="Currency code, e.g. USD, EUR, GBP")
    parser.add_argument("--fetch-mode",   default="common",
                        choices=["common", "fallback", "force-fallback", "local"],
                        help="fast-flights fetch mode")
    args = parser.parse_args()

    try:
        from fast_flights import FlightData, Passengers, get_flights
    except ImportError:
        print(json.dumps({
            "flights": [],
            "current_price_level": "",
            "error": (
                "fast-flights is not installed. "
                "Run: pip install fast-flights"
            )
        }))
        sys.exit(0)

    try:
        trip = "round-trip" if args.return_date else "one-way"

        flight_data = [
            FlightData(
                date=args.departure,
                from_airport=args.origin.upper(),
                to_airport=args.destination.upper(),
            )
        ]

        # For round-trips, add the return leg
        if args.return_date:
            flight_data.append(
                FlightData(
                    date=args.return_date,
                    from_airport=args.destination.upper(),
                    to_airport=args.origin.upper(),
                )
            )

        result = get_flights(
            flight_data=flight_data,
            trip=trip,
            passengers=Passengers(adults=args.adults),
            seat=args.seat,
            fetch_mode=args.fetch_mode,
        )

        flights = []
        for f in result.flights:
            # Parse price — may have currency symbol prefix, e.g. "$430" or "430"
            raw_price = str(f.price).strip()
            # Remove non-numeric characters except decimal point
            numeric_price = "".join(c for c in raw_price if c.isdigit() or c == ".")
            try:
                price_val = float(numeric_price) if numeric_price else 0.0
            except ValueError:
                price_val = 0.0

            flights.append({
                "airline": f.name,
                "origin": args.origin.upper(),
                "destination": args.destination.upper(),
                "departure_date": args.departure,
                "return_date": args.return_date,
                "departure_time": f.departure,
                "arrival_time": f.arrival,
                "duration": f.duration,
                "stops": f.stops,
                "delay": f.delay,
                "price": price_val,
                "currency": args.currency,
                "is_best": f.is_best,
            })

        print(json.dumps({
            "flights": flights,
            "current_price_level": result.current_price,
            "error": None,
        }))

    except RuntimeError as e:
        print(json.dumps({
            "flights": [],
            "current_price_level": "",
            "error": summarize_error_message(str(e)),
        }))

    except (KeyError, ValueError, AttributeError, TypeError) as e:
        import traceback
        print(json.dumps({
            "flights": [],
            "current_price_level": "",
            "error": f"Data parsing error: {e}",
        }), file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({
            "flights": [],
            "current_price_level": "",
            "error": f"Data parsing error: {type(e).__name__}: {e}",
        }))


if __name__ == "__main__":
    main()
