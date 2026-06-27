import { describe, it, expect } from "vitest";
import { validateItineraryConstraints, parseCost, violationsToPromptHint } from "../itineraryConstraints";
import { TripItinerary, TripPlannerInput, BudgetSplit, ItineraryActivity, Attraction } from "../types";

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeInput(over: Partial<TripPlannerInput> = {}): TripPlannerInput {
  return {
    budget: 2000,
    currency: "USD",
    homeCity: "London",
    startDate: "2026-07-01",
    endDate: "2026-07-03", // 3 days inclusive
    flexDays: 0,
    travelers: 2,
    likedActivities: ["hiking"],
    dislikedActivities: [],
    travelMode: ["Flight", "Train"],
    travelStyle: "balanced",
    travelPriorities: "nature",
    ...over,
  };
}

function makeBudgetSplit(over: Partial<BudgetSplit> = {}): BudgetSplit {
  return { travel: 700, accommodation: 600, food: 300, activities: 240, misc: 160, ...over };
}

function act(over: Partial<ItineraryActivity> = {}): ItineraryActivity {
  return {
    time: "09:00",
    activity: "Visit Museum",
    location: "Paris",
    duration: "2h",
    cost: "free",
    type: "attraction",
    ...over,
  };
}

/** Build a valid 3-day Paris itinerary; pass overrides for specific days. */
function makeItinerary(over: Partial<TripItinerary> = {}): TripItinerary {
  return {
    destination: "Paris, France",
    totalDays: 3,
    overview: "A trip",
    days: [
      { day: 1, location: "Paris", theme: "art", morning: [act({ activity: "Louvre" })], afternoon: [act({ activity: "Musée d'Orsay" })], evening: [] },
      { day: 2, location: "Paris", theme: "food", morning: [act({ activity: "Eiffel Tower" })], afternoon: [act({ activity: "Le Bistro", type: "food" })], evening: [] },
      { day: 3, location: "Paris", theme: "walk", morning: [act({ activity: "Montmartre" })], afternoon: [], evening: [act({ activity: "Seine Cruise dinner", type: "food" })] },
    ],
    topAttractions: [],
    foodRecommendations: [],
    route: [],
    practicalTips: [],
    bestTimeToVisit: "Summer",
    ...over,
  };
}

// ── parseCost ─────────────────────────────────────────────────────────────────

describe("parseCost", () => {
  it("treats free/included as 0", () => {
    expect(parseCost("free")).toBe(0);
    expect(parseCost("Free entry")).toBe(0);
    expect(parseCost("included")).toBe(0);
  });
  it("extracts a single amount", () => {
    expect(parseCost("~$30")).toBe(30);
    expect(parseCost("€15")).toBe(15);
    expect(parseCost("1,200 USD")).toBe(1200);
  });
  it("takes the upper bound of a range", () => {
    expect(parseCost("€15-20")).toBe(20);
  });
  it("returns null for unparseable / empty", () => {
    expect(parseCost("varies")).toBeNull();
    expect(parseCost("")).toBeNull();
    expect(parseCost(null)).toBeNull();
    expect(parseCost(undefined)).toBeNull();
  });
});

// ── All-pass case ───────────────────────────────────────────────────────────

describe("validateItineraryConstraints — clean itinerary", () => {
  it("passes with no violations", () => {
    const report = validateItineraryConstraints(makeItinerary(), makeInput(), makeBudgetSplit());
    expect(report.violations).toEqual([]);
    expect(report.passed).toBe(true);
    expect(report.finalPass).toBe(true);
  });
});

// ── Hard violations ───────────────────────────────────────────────────────────

describe("validateItineraryConstraints — hard violations", () => {
  it("flags day count clearly outside the trip span", () => {
    const it = makeItinerary({ totalDays: 5 }); // dates span 2-3 days; 5 is out of range
    const report = validateItineraryConstraints(it, makeInput(), makeBudgetSplit());
    expect(report.passed).toBe(false);
    expect(report.violations.some((v) => v.rule === "day_count")).toBe(true);
  });

  it("tolerates the nights-vs-days ambiguity (3 days for a 4-day span is OK)", () => {
    // 2026-08-10..2026-08-13 = 4 inclusive days / 3 nights — both 3 and 4 are acceptable.
    const fourDayInput = makeInput({ startDate: "2026-08-10", endDate: "2026-08-13" });
    const threeDay = makeItinerary({ totalDays: 3 });
    expect(
      validateItineraryConstraints(threeDay, fourDayInput, makeBudgetSplit())
        .violations.some((v) => v.rule === "day_count")
    ).toBe(false);
    const fourDay = makeItinerary({
      totalDays: 4,
      days: [...makeItinerary().days, { day: 4, location: "Paris", theme: "x", morning: [act()], afternoon: [], evening: [] }],
    });
    expect(
      validateItineraryConstraints(fourDay, fourDayInput, makeBudgetSplit())
        .violations.some((v) => v.rule === "day_count")
    ).toBe(false);
  });

  it("flags days[] length disagreeing with totalDays", () => {
    const base = makeItinerary();
    const it = { ...base, totalDays: 3, days: base.days.slice(0, 2) }; // 2 days, totalDays 3
    const report = validateItineraryConstraints(it, makeInput({ endDate: "2026-07-02" }), makeBudgetSplit());
    expect(report.violations.some((v) => v.rule === "day_array_length")).toBe(true);
  });

  it("flags over-budget when most costs are parseable and exceed food+activities+misc", () => {
    const expensive = makeItinerary({
      days: [
        { day: 1, location: "Paris", theme: "x", morning: [act({ cost: "$400" })], afternoon: [act({ cost: "$400" })], evening: [] },
        { day: 2, location: "Paris", theme: "x", morning: [act({ cost: "$400" })], afternoon: [], evening: [] },
        { day: 3, location: "Paris", theme: "x", morning: [act({ cost: "$400" })], afternoon: [], evening: [] },
      ],
    });
    // food+activities+misc = 300+240+160 = 700; total parsed = 1600
    const report = validateItineraryConstraints(expensive, makeInput(), makeBudgetSplit());
    expect(report.violations.some((v) => v.rule === "budget")).toBe(true);
  });

  it("does NOT flag budget when costs are mostly unparseable (avoids false positives)", () => {
    const vague = makeItinerary({
      days: [
        { day: 1, location: "Paris", theme: "x", morning: [act({ cost: "varies" })], afternoon: [act({ cost: "depends" })], evening: [] },
        { day: 2, location: "Paris", theme: "x", morning: [act({ cost: "$5000" })], afternoon: [], evening: [] },
        { day: 3, location: "Paris", theme: "x", morning: [act({ cost: "ask" })], afternoon: [], evening: [] },
      ],
    });
    const report = validateItineraryConstraints(vague, makeInput(), makeBudgetSplit());
    expect(report.violations.some((v) => v.rule === "budget")).toBe(false);
  });

  it("flags transport using a mode the user excluded", () => {
    const it = makeItinerary({
      days: [
        { day: 1, location: "Paris", theme: "x", morning: [act({ activity: "Rental car drive to Versailles", location: "Versailles", type: "transport" })], afternoon: [act()], evening: [] },
        { day: 2, location: "Paris", theme: "x", morning: [act()], afternoon: [], evening: [] },
        { day: 3, location: "Paris", theme: "x", morning: [act()], afternoon: [], evening: [] },
      ],
    });
    const report = validateItineraryConstraints(it, makeInput({ travelMode: ["Flight", "Train"] }), makeBudgetSplit());
    expect(report.violations.some((v) => v.rule === "transport_mode")).toBe(true);
  });

  it("does NOT flag transport that uses an allowed mode", () => {
    const it = makeItinerary({
      days: [
        { day: 1, location: "Paris", theme: "x", morning: [act({ activity: "Train to Versailles", location: "Versailles", type: "transport" })], afternoon: [act()], evening: [] },
        { day: 2, location: "Paris", theme: "x", morning: [act()], afternoon: [], evening: [] },
        { day: 3, location: "Paris", theme: "x", morning: [act()], afternoon: [], evening: [] },
      ],
    });
    const report = validateItineraryConstraints(it, makeInput({ travelMode: ["Flight", "Train"] }), makeBudgetSplit());
    expect(report.violations.some((v) => v.rule === "transport_mode")).toBe(false);
  });
});

// ── Commonsense violations ──────────────────────────────────────────────────

describe("validateItineraryConstraints — commonsense violations", () => {
  it("flags an empty day", () => {
    const it = makeItinerary({
      days: [
        { day: 1, location: "Paris", theme: "x", morning: [act()], afternoon: [], evening: [] },
        { day: 2, location: "Paris", theme: "x", morning: [], afternoon: [], evening: [] },
        { day: 3, location: "Paris", theme: "x", morning: [act()], afternoon: [], evening: [] },
      ],
    });
    const report = validateItineraryConstraints(it, makeInput(), makeBudgetSplit());
    expect(report.passed).toBe(true); // commonsense only → still passes
    expect(report.finalPass).toBe(false);
    expect(report.violations.some((v) => v.rule === "empty_day")).toBe(true);
  });

  it("flags a duplicate attraction across days (accent-insensitive)", () => {
    const it = makeItinerary({
      days: [
        { day: 1, location: "Paris", theme: "x", morning: [act({ activity: "Musée d'Orsay" })], afternoon: [], evening: [] },
        { day: 2, location: "Paris", theme: "x", morning: [act({ activity: "Musee dOrsay" })], afternoon: [], evening: [] },
        { day: 3, location: "Paris", theme: "x", morning: [act()], afternoon: [], evening: [] },
      ],
    });
    const report = validateItineraryConstraints(it, makeInput(), makeBudgetSplit());
    expect(report.violations.some((v) => v.rule === "duplicate_venue")).toBe(true);
  });

  // NOTE: the "wrong_city" rule was removed after live testing (see lib/itineraryConstraints.ts) —
  // day.location is a thematic title in practice and day-trips are legitimate, so string-matching
  // produced only false positives. No test asserts it any more.
  it("does NOT flag legitimate regional day-trips as a city mismatch", () => {
    const it = makeItinerary({
      days: [
        // Thematic day title + a nearby day-trip location — must NOT be flagged.
        { day: 1, location: "Grindelwald Village & Bachalpsee", theme: "hike", morning: [act({ activity: "Hike", location: "Bachalpsee Trailhead" })], afternoon: [], evening: [] },
        { day: 2, location: "Männlichen Ridge", theme: "hike", morning: [act({ activity: "Lunch", location: "Wengen", type: "food" })], afternoon: [], evening: [] },
        { day: 3, location: "Grindelwald", theme: "rest", morning: [act()], afternoon: [], evening: [] },
      ],
    });
    const report = validateItineraryConstraints(it, makeInput(), makeBudgetSplit());
    expect(report.violations.some((v) => v.rule === "wrong_city")).toBe(false);
  });
});

// ── Within-sandbox (hallucination) ──────────────────────────────────────────

describe("validateItineraryConstraints — within sandbox", () => {
  const indexed: Attraction[] = [
    { name: "Louvre", type: "culture", description: "", estimatedDuration: "3h", tips: "", offBeatenPath: false, cost: "moderate" },
    { name: "Eiffel Tower", type: "tourist", description: "", estimatedDuration: "2h", tips: "", offBeatenPath: false, cost: "cheap" },
  ];

  it("flags an attraction not present in the index when an index is provided", () => {
    const it = makeItinerary({
      days: [
        { day: 1, location: "Paris", theme: "x", morning: [act({ activity: "Louvre" })], afternoon: [act({ activity: "Imaginary Castle of Nowhere" })], evening: [] },
        { day: 2, location: "Paris", theme: "x", morning: [act({ activity: "Eiffel Tower" })], afternoon: [], evening: [] },
        { day: 3, location: "Paris", theme: "x", morning: [act({ activity: "Louvre Annex" })], afternoon: [], evening: [] },
      ],
    });
    const report = validateItineraryConstraints(it, makeInput(), makeBudgetSplit(), indexed);
    expect(report.violations.some((v) => v.rule === "within_sandbox" && /Imaginary Castle/.test(v.detail))).toBe(true);
  });

  it("does NOT run the sandbox check when no index is provided", () => {
    const it = makeItinerary({
      days: [
        { day: 1, location: "Paris", theme: "x", morning: [act({ activity: "Totally Made Up Place" })], afternoon: [], evening: [] },
        { day: 2, location: "Paris", theme: "x", morning: [act()], afternoon: [], evening: [] },
        { day: 3, location: "Paris", theme: "x", morning: [act()], afternoon: [], evening: [] },
      ],
    });
    const report = validateItineraryConstraints(it, makeInput(), makeBudgetSplit()); // no index
    expect(report.violations.some((v) => v.rule === "within_sandbox")).toBe(false);
  });
});

// ── Prompt hint ──────────────────────────────────────────────────────────────

describe("violationsToPromptHint", () => {
  it("returns empty string when no violations", () => {
    const report = validateItineraryConstraints(makeItinerary(), makeInput(), makeBudgetSplit());
    expect(violationsToPromptHint(report)).toBe("");
  });
  it("lists violations for a re-prompt", () => {
    const it = makeItinerary({ totalDays: 9 });
    const report = validateItineraryConstraints(it, makeInput(), makeBudgetSplit());
    const hint = violationsToPromptHint(report);
    expect(hint).toContain("day_count");
    expect(hint).toContain("Fix ALL");
  });
});
