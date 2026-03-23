import { Destination } from "@/lib/types";
import { FlightTimeLookupResult } from "@/lib/flightPrices";

type ResolveFlightTimeOptions = {
  hasTravelLimit: boolean;
  shouldCheckLiveFlightPrices: boolean;
  canVerifyLiveFlightHours: boolean;
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

  if (options.hasTravelLimit && options.shouldCheckLiveFlightPrices && options.canVerifyLiveFlightHours) {
    // Live lookup failed but we still have an estimatedFlightHours; fall back to that with a small penalty
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
