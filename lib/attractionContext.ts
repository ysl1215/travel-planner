/**
 * Formats indexed attraction data into a compact string for LLM prompt injection.
 * Keeps token cost low while giving the model real duration/difficulty/tip data.
 */

import { Attraction } from "@/lib/db";

/**
 * Selects the most relevant attractions for a given trip and formats them
 * as a compact context block to inject into the itinerary prompt.
 *
 * @param attractions  All attractions for the city from the DB index
 * @param preferences  User's liked activities and style (for relevance filtering)
 * @param maxItems     Cap to avoid blowing the prompt token budget. When tripDays is
 *                     provided, the cap scales with trip length (~5/day, ceiling 20) so a
 *                     short trip doesn't carry 20 candidates it can never schedule.
 */
export function buildAttractionContext(
  attractions: Attraction[],
  preferences: { likedActivities: string[]; travelStyle: string; preferHiddenGems?: boolean; tripDays?: number },
  maxItems?: number
): string {
  if (!attractions.length) return "";

  const cap = maxItems ?? (preferences.tripDays ? Math.min(20, Math.max(5, preferences.tripDays * 5)) : 20);

  // Score each attraction for relevance to user preferences
  const scored = attractions.map((a) => {
    let score = 0;

    // Prefer off-beaten-path when user wants hidden gems
    if (preferences.preferHiddenGems) {
      if (a.best_for.includes("off-beaten-path")) score += 3;
      if (a.crowd_level === "low") score += 2;
      if (a.crowd_level === "high") score -= 2;
      // Low trending score = less touristy = boost for hidden gems seekers
      if (a.trending_score === 0) score += 1;
      else if (a.trending_score > 500_000) score -= 2;  // viral = crowded
    } else {
      // For mainstream travelers, trending is a positive signal
      if (a.trending_score > 100_000) score += 1;
    }

    // Match activity types to liked activities
    const liked = preferences.likedActivities.map((l) => l.toLowerCase());
    if (liked.some((l) => l.includes("hik") || l.includes("trek")) && a.type === "trail") score += 3;
    if (liked.some((l) => l.includes("food") || l.includes("culinar")) && a.type === "food") score += 3;
    if (liked.some((l) => l.includes("museum") || l.includes("histor") || l.includes("cultur")) && ["museum", "neighbourhood"].includes(a.type)) score += 2;
    if (liked.some((l) => l.includes("nature") || l.includes("wildlife")) && ["trail", "lake", "viewpoint", "beach"].includes(a.type)) score += 2;
    if (liked.some((l) => l.includes("photo")) && a.best_for.includes("photography")) score += 2;

    // Prefer entries with real duration data over estimated
    if (a.confidence === "high") score += 2;
    if (a.confidence === "medium") score += 1;

    return { a, score };
  });

  // Sort by score desc, take top N
  const top = scored
    .sort((x, y) => y.score - x.score)
    .slice(0, cap)
    .map((s) => s.a);

  // Format as compact lines — one attraction per line to minimise tokens
  const lines = top.map((a) => {
    const dur = a.duration_min !== null && a.duration_max !== null
      ? `${a.duration_min}-${a.duration_max}min`
      : a.duration_min !== null
      ? `~${a.duration_min}min`
      : null;

    const parts: string[] = [`[${a.type}] ${a.name}`];
    if (dur) parts.push(`duration:${dur}(${a.confidence})`);
    if (a.difficulty && a.difficulty !== "N/A") parts.push(`difficulty:${a.difficulty}`);
    if (a.distance_km) parts.push(`${a.distance_km}km`);
    if (a.crowd_level) parts.push(`crowd:${a.crowd_level}`);
    if (a.highlights.length) parts.push(`highlights:${a.highlights.slice(0, 2).join("|")}`);
    if (a.nearby.length) parts.push(`nearby:${a.nearby.slice(0, 3).join("|")}`);
    if (a.tips) parts.push(`tip:${a.tips.slice(0, 120)}`);

    return parts.join(" · ");
  });

  return [
    `INDEXED ATTRACTIONS FOR THIS CITY (${top.length} of ${attractions.length} total, selected for relevance):`,
    `Use these real durations and tips when scheduling days. duration confidence: high=from source, medium=inferred, estimated=AI guess.`,
    ...lines,
  ].join("\n");
}
