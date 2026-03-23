import test from "node:test";
import assert from "node:assert/strict";

import { buildDestinationPrompt } from "../lib/prompts";
import { getTravelHint } from "../lib/travelHints";

test("buildDestinationPrompt includes origin-aware guidance for strict limits", () => {
  const prompt = buildDestinationPrompt(
    {
      budget: 3000,
      currency: "USD",
      homeCity: "Shanghai",
      startDate: "2026-04-01",
      endDate: "2026-04-10",
      flexDays: 3,
      travelers: 1,
      likedActivities: ["Food & Culinary"],
      dislikedActivities: [],
      travelMode: ["Flight"],
      maxTravelHours: 3,
      travelStyle: "Mid-range Comfort",
    },
    "PVG",
    getTravelHint("Shanghai", 3)
  );

  assert.match(prompt, /Origin-aware guidance:/);
  assert.match(prompt, /Nearby bucket: east-asia/);
  assert.match(prompt, /Tokyo/);
});
