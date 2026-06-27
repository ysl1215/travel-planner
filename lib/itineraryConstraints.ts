/**
 * Deterministic itinerary constraint validation.
 *
 * After the LLM generates a TripItinerary (and it passes JSON-schema validation),
 * this checks the plan as a whole against the user's hard constraints and a set of
 * commonsense rules. Motivation: the TravelPlanner benchmark (ICML'24) found that
 * LLMs satisfy individual constraints but routinely fail their *conjunction* — they
 * hallucinate venues, drift over budget, repeat places, and put activities in the
 * wrong city. None of these checks use the LLM; they are pure and deterministic.
 *
 * Costs in the itinerary are free-text ("free", "~$30", "€15-20"), so budget checks
 * are best-effort: we only flag a violation when we can confidently parse enough of
 * the costs AND the total clearly exceeds the budget. Unparseable costs are skipped,
 * never assumed.
 */

import { TripItinerary, TripPlannerInput, BudgetSplit, ItineraryActivity } from "./types";

export interface ConstraintViolation {
  rule: string;
  severity: "hard" | "commonsense";
  detail: string;
}

export interface ConstraintReport {
  /** No hard violations (commonsense misses allowed). */
  passed: boolean;
  /** No violations of any kind — the strict "final pass" metric from the benchmark. */
  finalPass: boolean;
  violations: ConstraintViolation[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Lowercase, strip accents, collapse whitespace — mirrors normalize_name() in scrape_attractions.py. */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining accent marks
    .replace(/[^\w\s]/g, "")          // strip punctuation (apostrophes, hyphens, etc.) for robust matching
    .replace(/\s+/g, " ")
    .trim();
}

/** All activities across all time slots of all days, tagged with their day number. */
function allActivities(itinerary: TripItinerary): { day: number; dayLocation: string; act: ItineraryActivity }[] {
  const out: { day: number; dayLocation: string; act: ItineraryActivity }[] = [];
  for (const d of itinerary.days ?? []) {
    for (const slot of [d.morning, d.afternoon, d.evening]) {
      for (const act of slot ?? []) {
        out.push({ day: d.day, dayLocation: d.location ?? "", act });
      }
    }
  }
  return out;
}

/**
 * Best-effort parse of a free-text cost into a number. Returns null when there is no
 * confident numeric amount (e.g. "free" → 0, "varies" → null, "~$30" → 30, "€15-20" → 20).
 * Ranges take the upper bound (conservative for an over-budget check).
 */
export function parseCost(cost: string | undefined | null): number | null {
  if (cost == null) return null;
  const s = String(cost).trim().toLowerCase();
  if (s === "" || s === "n/a") return null;
  if (/\bfree\b|\bno cost\b|\bincluded\b/.test(s)) return 0;
  // Collect all numbers (handles "15-20", "1,200", "30.50"); take the max as upper bound.
  const nums = (s.replace(/,/g, "").match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => !Number.isNaN(n));
  if (nums.length === 0) return null;
  return Math.max(...nums);
}

/** Map a user travelMode label to keywords that would appear in a transport activity. */
const MODE_KEYWORDS: Record<string, string[]> = {
  flight: ["flight", "fly", "plane", "airport", "airline"],
  train: ["train", "rail", "metro", "subway", "tram"],
  "rental car": ["car", "drive", "driving", "road trip", "rental"],
  bus: ["bus", "coach", "shuttle"],
  cruise: ["cruise", "ferry", "boat", "ship"],
};

/** Days between two YYYY-MM-DD dates, inclusive of both endpoints. Null if unparseable. */
function inclusiveDaySpan(startDate?: string, endDate?: string): number | null {
  if (!startDate || !endDate) return null;
  const start = Date.parse(startDate);
  const end = Date.parse(endDate);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.round((end - start) / 86_400_000) + 1;
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Validate a generated itinerary against the user's constraints. Pure function.
 *
 * @param knownAttractions optional indexed attractions for the destination. When
 *   provided (non-empty), enables the "within sandbox" check that flags attractions
 *   not present in the index (the no-hallucinated-venue rule). Skipped when absent.
 *   Only `.name` is read, so both lib/types and lib/db Attraction rows are accepted.
 */
export function validateItineraryConstraints(
  itinerary: TripItinerary,
  input: TripPlannerInput,
  budgetSplit: BudgetSplit,
  knownAttractions?: { name: string }[]
): ConstraintReport {
  const violations: ConstraintViolation[] = [];
  const acts = allActivities(itinerary);

  // ── HARD: day count matches the requested trip length ──────────────────────
  // "Days" is genuinely ambiguous: Aug 10–13 is 4 inclusive calendar days but 3 nights,
  // and an itinerary of activity-days commonly equals nights (no full day on departure).
  // Accept either reading — flag only when totalDays is outside [nights, inclusiveDays].
  const inclusiveDays = inclusiveDaySpan(input.startDate, input.endDate);
  if (inclusiveDays != null) {
    const nights = inclusiveDays - 1;
    if (itinerary.totalDays < nights || itinerary.totalDays > inclusiveDays) {
      violations.push({
        rule: "day_count",
        severity: "hard",
        detail: `Itinerary has ${itinerary.totalDays} day(s) but ${input.startDate}–${input.endDate} is ${nights}–${inclusiveDays} days.`,
      });
    }
  }
  // Also flag if the days array length disagrees with totalDays.
  if (itinerary.days && itinerary.days.length !== itinerary.totalDays) {
    violations.push({
      rule: "day_array_length",
      severity: "hard",
      detail: `totalDays=${itinerary.totalDays} but days[] has ${itinerary.days.length} entr(ies).`,
    });
  }

  // ── HARD: total estimated cost within budget (best-effort) ─────────────────
  const parsed = acts.map(({ act }) => parseCost(act.cost));
  const known = parsed.filter((n): n is number => n != null);
  // Only judge budget when we parsed a meaningful share of activity costs, to avoid
  // false positives from itineraries that mostly omit numeric costs.
  if (acts.length > 0 && known.length >= Math.ceil(acts.length / 2)) {
    const activitiesTotal = known.reduce((a, b) => a + b, 0);
    // Activity costs map to the food + activities + misc slices (travel/accommodation
    // are priced separately by the flight/hotel providers, not the itinerary).
    const activitiesBudget = budgetSplit.food + budgetSplit.activities + budgetSplit.misc;
    if (activitiesTotal > activitiesBudget) {
      violations.push({
        rule: "budget",
        severity: "hard",
        detail: `Parsed activity/food/misc costs total ~${activitiesTotal} ${input.currency}, exceeding the ${activitiesBudget} ${input.currency} budgeted for those categories.`,
      });
    }
  }

  // ── HARD: transport modes ⊆ user's allowed travelMode ──────────────────────
  const allowed = (input.travelMode ?? []).map((m) => m.toLowerCase());
  if (allowed.length > 0) {
    const matchesMode = (text: string, mode: string) =>
      (MODE_KEYWORDS[mode] ?? [mode]).some((kw) => new RegExp(`\\b${kw}\\b`).test(text));
    for (const { day, act } of acts) {
      if (act.type !== "transport") continue;
      const text = `${act.activity} ${act.location}`.toLowerCase();
      // Modes this activity implies, and whether any of them is allowed.
      const impliedModes = Object.keys(MODE_KEYWORDS).filter((mode) => matchesMode(text, mode));
      if (impliedModes.length === 0) continue; // generic transport, no specific mode named
      const usesAllowed = allowed.some((a) => matchesMode(text, a));
      if (!usesAllowed) {
        violations.push({
          rule: "transport_mode",
          severity: "hard",
          detail: `Day ${day} uses "${impliedModes[0]}" transport ("${act.activity}") but allowed modes are: ${input.travelMode.join(", ")}.`,
        });
      }
    }
  }

  // ── COMMONSENSE: no empty days ─────────────────────────────────────────────
  for (const d of itinerary.days ?? []) {
    const count = (d.morning?.length ?? 0) + (d.afternoon?.length ?? 0) + (d.evening?.length ?? 0);
    if (count === 0) {
      violations.push({
        rule: "empty_day",
        severity: "commonsense",
        detail: `Day ${d.day} (${d.location}) has no activities in any time slot.`,
      });
    }
  }

  // ── COMMONSENSE: no duplicate attractions / restaurants across the trip ────
  const seen = new Map<string, number>(); // normalized name -> first day seen
  for (const { day, act } of acts) {
    if (act.type !== "attraction" && act.type !== "food") continue;
    const key = normalizeName(act.activity);
    if (key === "") continue;
    if (seen.has(key)) {
      violations.push({
        rule: "duplicate_venue",
        severity: "commonsense",
        detail: `"${act.activity}" appears on day ${seen.get(key)} and again on day ${day}.`,
      });
    } else {
      seen.set(key, day);
    }
  }

  // NOTE: a "wrong-city" check (activity location vs the day's city) was tried and
  // removed after live testing — `day.location` is in practice a thematic day-title
  // ("Männlichen Ridge & Hidden Valleys"), not a clean city, and single-base trips
  // legitimately include regional day-trips. String-matching produced ~12 false
  // positives per realistic itinerary and zero true positives, which would train users
  // to ignore the caveat badge. Reliable detection needs structured per-day city data
  // we don't have, so the check is intentionally omitted rather than left noisy.

  // ── COMMONSENSE: within sandbox (no hallucinated attractions) ──────────────
  // Only when an attraction index exists for the destination.
  if (knownAttractions && knownAttractions.length > 0) {
    const indexed = new Set(knownAttractions.map((a) => normalizeName(a.name)));
    for (const { day, act } of acts) {
      if (act.type !== "attraction") continue;
      const key = normalizeName(act.activity);
      if (key === "") continue;
      // Match if any indexed name contains, or is contained by, the activity name.
      const inIndex = indexed.has(key) ||
        [...indexed].some((name) => name.includes(key) || key.includes(name));
      if (!inIndex) {
        violations.push({
          rule: "within_sandbox",
          severity: "commonsense",
          detail: `Day ${day} attraction "${act.activity}" is not in the indexed attraction data for this destination (possible hallucination).`,
        });
      }
    }
  }

  const hardViolations = violations.filter((v) => v.severity === "hard");
  return {
    passed: hardViolations.length === 0,
    finalPass: violations.length === 0,
    violations,
  };
}

/** Render violations into a compact instruction block for a corrective re-prompt. */
export function violationsToPromptHint(report: ConstraintReport): string {
  if (report.violations.length === 0) return "";
  const lines = report.violations.map((v) => `- [${v.severity}] ${v.rule}: ${v.detail}`);
  return `The previous itinerary violated these constraints. Fix ALL of them and return corrected JSON only:\n${lines.join("\n")}`;
}
