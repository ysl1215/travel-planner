import { describe, it, expect } from "vitest";
import { scoreDestination, scoreAndSortDestinations } from "../preferenceMatch";
import { Destination } from "../types";

function makeDest(overrides: Partial<Destination> = {}): Destination {
  return {
    id: "test-1",
    country: "Thailand",
    city: "Chiang Mai",
    rationale: "Great hiking and nature",
    highlights: ["Doi Inthanon", "jungle trekking"],
    estimatedFlightHours: 4,
    estimatedBudgetFit: "excellent",
    bestTimeToVisit: "Nov-Feb",
    vibeMatch: ["hiking", "nature", "culture"],
    imageQuery: "Chiang Mai Thailand",
    ...overrides,
  };
}

describe("scoreDestination", () => {
  it("gives positive score when vibeMatch aligns with liked activities", () => {
    const dest = makeDest({ vibeMatch: ["hiking", "trekking", "nature"] });
    const result = scoreDestination(dest, ["Hiking & Trekking"], [], false);
    expect(result.score).toBeGreaterThan(0);
    expect(result.matchedLikes).toContain("Hiking & Trekking");
  });

  it("gives negative score when vibeMatch aligns with disliked activities", () => {
    const dest = makeDest({
      city: "Ibiza",
      vibeMatch: ["nightlife", "clubbing", "party"],
      highlights: ["club scene", "bars"],
    });
    const result = scoreDestination(dest, [], ["Nightlife"], false);
    expect(result.score).toBeLessThan(0);
    expect(result.matchedDislikes).toContain("Nightlife");
  });

  it("penalises generic cities when preferHiddenGems is true", () => {
    const dest = makeDest({ city: "Paris", country: "France" });
    const result = scoreDestination(dest, [], [], true);
    expect(result.score).toBeLessThan(0);
    expect(result.genericPenalty).toBe(true);
  });

  it("does not penalise generic cities when preferHiddenGems is false", () => {
    const dest = makeDest({ city: "Paris", country: "France" });
    const result = scoreDestination(dest, [], [], false);
    expect(result.score).toBe(0);
    expect(result.genericPenalty).toBe(false);
  });

  it("handles both likes and dislikes simultaneously", () => {
    const dest = makeDest({
      vibeMatch: ["hiking", "nightlife"],
      highlights: ["mountain trails", "pub crawl"],
    });
    const result = scoreDestination(dest, ["Hiking & Trekking"], ["Nightlife"], false);
    // Hiking matches give positive, nightlife matches give negative (heavier)
    expect(result.matchedLikes).toContain("Hiking & Trekking");
    expect(result.matchedDislikes).toContain("Nightlife");
  });

  it("returns zero score when no preferences match", () => {
    const dest = makeDest({ vibeMatch: ["relaxation", "wellness"] });
    const result = scoreDestination(dest, ["Skiing & Snow"], ["Shopping"], false);
    expect(result.score).toBe(0);
    expect(result.matchedLikes).toHaveLength(0);
    expect(result.matchedDislikes).toHaveLength(0);
  });

  it("caps score at [-1, 1]", () => {
    const dest = makeDest({
      vibeMatch: ["nightlife", "clubbing", "bars", "party", "pub crawl"],
      highlights: ["nightclub district", "bar scene"],
      rationale: "Famous for its nightlife and drinking culture",
    });
    const result = scoreDestination(dest, [], ["Nightlife"], false);
    expect(result.score).toBe(-1);
  });
});

describe("scoreAndSortDestinations", () => {
  it("separates matched from deprioritised destinations", () => {
    const hiking = makeDest({ id: "1", city: "Chiang Mai", vibeMatch: ["hiking", "trekking"] });
    const nightlife = makeDest({ id: "2", city: "Ibiza", vibeMatch: ["nightlife", "party", "clubbing"] });
    const cultural = makeDest({ id: "3", city: "Luang Prabang", vibeMatch: ["temple", "heritage", "cultural"] });

    const { matched, deprioritised } = scoreAndSortDestinations(
      [hiking, nightlife, cultural],
      ["Hiking & Trekking", "Cultural Sites"],
      ["Nightlife"],
      false
    );

    expect(matched.map((d) => d.city)).toContain("Chiang Mai");
    expect(matched.map((d) => d.city)).toContain("Luang Prabang");
    expect(deprioritised.map((d) => d.city)).toContain("Ibiza");
  });

  it("adds preferenceWarning to deprioritised destinations", () => {
    const nightlife = makeDest({ id: "1", city: "Ibiza", vibeMatch: ["nightlife", "clubbing"] });
    const { deprioritised } = scoreAndSortDestinations(
      [nightlife],
      [],
      ["Nightlife"],
      false
    );

    expect(deprioritised).toHaveLength(1);
    expect(deprioritised[0].preferenceWarning).toContain("Nightlife");
  });

  it("sorts matched destinations by score (highest first)", () => {
    const strong = makeDest({
      id: "1", city: "A",
      vibeMatch: ["hiking", "trekking", "trails", "mountains"],
      highlights: ["summit climb", "alpine trek"],
      rationale: "A paradise for hikers",
    });
    const weak = makeDest({
      id: "2", city: "B",
      vibeMatch: ["scenic views"],
      highlights: ["old town", "cafes"],
      rationale: "A charming town with one hiking trail nearby",
    });

    const { matched } = scoreAndSortDestinations(
      [weak, strong],
      ["Hiking & Trekking"],
      [],
      false
    );

    expect(matched[0].city).toBe("A");
  });

  it("deprioritises generic cities when preferHiddenGems is true", () => {
    const paris = makeDest({ id: "1", city: "Paris", vibeMatch: ["art", "culture"] });
    const obscure = makeDest({ id: "2", city: "Plovdiv", vibeMatch: ["art", "culture", "historical"] });

    const { matched, deprioritised } = scoreAndSortDestinations(
      [paris, obscure],
      ["Art & Architecture"],
      [],
      true
    );

    expect(matched.map((d) => d.city)).toContain("Plovdiv");
    expect(deprioritised.map((d) => d.city)).toContain("Paris");
  });
});
