import { Destination } from "@/lib/types";
import { FlightTimeLookupResult } from "@/lib/flightPrices";

type ResolveFlightTimeOptions = {
  hasTravelLimit: boolean;
  shouldCheckLiveFlightPrices: boolean;
  canVerifyLiveFlightHours: boolean;
  // When false, do NOT fall back to estimated hours; treat failed lookups as infinite travel time
  allowFallbackUnderLimit?: boolean;
};

export type ResolvedFlightTime = {
  destination: Destination;
  hours: number;
};

export function resolveDestinationTravelTime(
  destination: Destination,
  lookup: FlightTimeLookupResult,
  options: ResolveFlightTimeOptions
): ResolvedFlightTime {
  if (lookup.hours !== null) {
    return {
      destination: {
        ...destination,
        estimatedFlightHours: lookup.hours,
        verifiedThroughLiveSearch: lookup.verifiedThroughLiveSearch || destination.verifiedThroughLiveSearch === true,
      },
      hours: lookup.hours,
    };
  }

  if (options.hasTravelLimit && options.shouldCheckLiveFlightPrices) {
    // Strict mode: if fallbacks are disallowed, treat any failed verification (including missing airport)
    // as an unbounded travel time so it will be filtered out by the caller.
    if (options.allowFallbackUnderLimit === false) {
      return {
        destination: {
          ...destination,
          verifiedThroughLiveSearch: false,
        },
        hours: Number.POSITIVE_INFINITY,
      };
    }

    // Non-strict: fall back to the estimated flight hours (with a small penalty) so transient lookup
    // failures don't cause the entire suggestion set to be emptied.
    const fallbackEstimate = Number.isFinite(destination.estimatedFlightHours)
      ? destination.estimatedFlightHours + 0.5
      : Number.POSITIVE_INFINITY;
    console.warn(`resolveDestinationTravelTime: live lookup failed for ${destination.city}. Falling back to estimate (${fallbackEstimate}h)`);
    return {
      destination: {
        ...destination,
        estimatedFlightHours: fallbackEstimate,
        verifiedThroughLiveSearch: false,
      },
      hours: fallbackEstimate,
    };
  }

  return {
    destination,
    hours: destination.estimatedFlightHours,
  };
}
