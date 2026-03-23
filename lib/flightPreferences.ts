import { FlightPreference } from "./types";

export const FLIGHT_PREFERENCE_OPTIONS: Array<{
  value: FlightPreference;
  label: string;
  description: string;
}> = [
  {
    value: "cheapest",
    label: "Cheapest fare (recommended)",
    description: "Prioritize the lowest live price first.",
  },
  {
    value: "fewest-stops",
    label: "Fewest stops",
    description: "Prefer routes with fewer layovers, then lower fare.",
  },
  {
    value: "nonstop",
    label: "Nonstop only",
    description: "Show nonstop options when available.",
  },
  {
    value: "fastest",
    label: "Shortest duration",
    description: "Prefer the quickest itinerary, then lower fare.",
  },
];

export function normalizeFlightPreference(value?: string | null): FlightPreference {
  switch (value) {
    case "fewest-stops":
    case "nonstop":
    case "fastest":
      return value;
    case "cheapest":
    default:
      return "cheapest";
  }
}

export function formatFlightPreferenceLabel(value?: FlightPreference | null): string {
  const option = FLIGHT_PREFERENCE_OPTIONS.find((entry) => entry.value === (value ?? "cheapest"));
  return option?.label ?? "Cheapest fare (recommended)";
}
