# Improvement Opportunities

> Last updated: 2026-05-12

---

## Addressed this session

- [x] **Flight prices unreliable (fast-flights)** — Added Kiwi.com Tequila API as primary provider with fast-flights as fallback (`lib/kiwi.ts`, `app/api/prices/route.ts`).
- [x] **Destinations ignore maxTravelHours** — Added independent great-circle flight time validation (`lib/flightTime.ts`), prompt calibration with reference times, and server-side correction + filtering (`correctAndFilterByTravelTime`).
- [x] **Static train fares only** — Added live European train prices via hafas-client (`lib/hafas.ts`, `app/api/trains/route.ts`). Falls back to static estimates.
- [x] **Static accommodation estimates only** — Added live hotel prices via Amadeus Hotel Search API (`lib/amadeus.ts`, `app/api/hotels/route.ts`). Falls back to static estimates.

---

## Remaining gaps — New integrations

### Flight time validation (`lib/flightTime.ts`)

- [ ] **~30% of AI-suggested cities will not be in the coordinate table** — e.g. "Hoi An", "Cinque Terre", "Dubrovnik", "Kyoto", "Siem Reap". When `estimateFlightHours()` returns null, the AI's self-reported value is trusted unchanged. Mitigation: add Nominatim geocoding fallback (free, 1 req/s) for cities not in the static table.
- [ ] **Table only covers ~100 cities** — Good enough for common origins, but less useful for obscure home cities (e.g. "Chengdu" is in the table, but "Kunming" is not). Consider expanding or using the IATA airport coordinates from `lib/airports.ts`.
- [ ] **No connection time factored in** — Great-circle + 0.5h overhead is accurate for direct flights, but the AI may suggest destinations only reachable with a connection (adds 2-4h). The 20% buffer partially covers this but isn't perfect.

### Kiwi.com flights (`lib/kiwi.ts`)

- [ ] **No cache warming** — The first user to search a route waits for the API call. Consider pre-fetching prices for suggested destinations immediately after `/api/suggest` returns (fire-and-forget).
- [ ] **`date_from` and `date_to` are identical** — Currently searches only the exact departure date. Kiwi supports a range; using `flexDays` to widen the search window would show cheaper nearby dates.
- [ ] **Stop count heuristic** — Outbound leg stop calculation (`result.route.indexOf(r) < result.route.length / 2`) is fragile for complex itineraries with stopovers.

### hafas-client trains (`lib/hafas.ts`)

- [ ] **Only uses DB profile** — Deutsche Bahn's backend covers most of Europe, but some routes (e.g. UK domestic via National Rail, Spain via Renfe) may not return results or prices. Adding SNCF/OEBB profiles as fallback would improve coverage.
- [ ] **Price data not always available** — hafas journeys don't always include price data (depends on operator). When `minPrice` is null, `toTrainEstimate()` defaults to 30 EUR which may be wrong.
- [ ] **No timeout on client initialization** — `getClient()` caches the promise but doesn't handle the case where the dynamic import fails (e.g. module not installed). Should add a timeout wrapper.
- [ ] **Station search can be slow** — `findStation()` does a fuzzy text search. For commonly-searched cities, a pre-mapped station ID table would avoid the extra network call.

### Amadeus hotels (`lib/amadeus.ts`)

- [ ] **Two API calls per search** — "list hotels by city" + "get offers" costs 2 quota hits per request. Could cache the hotel ID list per city (changes rarely) to halve the quota usage.
- [ ] **Hostel estimate is synthetic** — `toAccomEstimate()` uses `cheapest * 0.4` for the hostel tier, which is a rough guess. Amadeus doesn't list hostels. Consider supplementing with Hostelworld data or keeping the static hostel values.
- [ ] **City code coverage** — `cityToIataCode()` only maps ~45 cities. If the AI suggests a city not in this map, Amadeus search won't run. Could share the IATA map with `lib/airports.ts`.

---

## Remaining gaps — Scripts (from initial investigation)

### 1. `scripts/scrape_attractions.py` (highest impact)

#### Reliability
- [ ] **No HTTP retry logic** — `fetch()` fails immediately on transient errors. Should retry 2-3 times with backoff.
- [ ] **Duplicate JSON parsing logic** — "strip markdown fences -> find `[...]` -> `json.loads`" copy-pasted in two places. Should be a shared helper.
- [ ] **OSM Overpass uses GET requests** — Long queries can exceed URL length limits. POST is recommended.
- [x] **Fragile YouTube scraping** — Replaced HTML regex with yt-dlp `ytsearch:` built-in search.
- [x] **Trending signals are likely broken** — Replaced with Wikipedia Pageviews API (free, reliable, absolute view counts).

#### Resource management
- [ ] **Excessive DB connection churn** — 4+ `get_db()` calls per city. Use single connection with context manager.
- [ ] **No rate limit between LLM calls** — Wikivoyage and YouTube LLM calls fire back-to-back. Free-tier will 429.
- [ ] **Row-by-row trending score updates** — Use `executemany` with single commit.

#### Correctness
- [ ] **Dead module-level HEADERS dict** — `fetch()` overrides per-call; module-level is unused.
- [ ] **Weak name deduplication** — `.lower()` only. No unicode normalization or whitespace handling.
- [ ] **No LLM response validation** — JSON array trusted without checking `name` field or enum values.

#### Missing features
- [ ] **No resume/checkpoint within a city** — Re-run repeats all work.
- [ ] **No `--concurrency` flag** — Sequential processing is slow.

### 2. `scripts/google_flights.py` (now fallback — lower priority)

- [ ] **No retry on transient failures** — Should retry 2-3 times.
- [ ] **Broad exception gap** — Uncaught exceptions crash without JSON output.
- [ ] **No IATA code validation** — Invalid codes produce confusing errors.
- [ ] **Currency is label-only** — `fast-flights` ignores the currency parameter.

### 3. `scripts/init_db.py` (low impact)

- [ ] **Brittle migration tracking** — `try ALTER TABLE / except`. Add `schema_version` table.
- [ ] **No parent directory creation** — `data/` must exist.
- [ ] **No context manager for connection** — Use `with closing(...)`.

### 4. `scripts/choose-ai-provider.js` (low impact)

- [ ] **Strips blank lines** from `.env.local`.
- [ ] **Doesn't handle quoted values** — `AI_PROVIDER="openrouter"`.
- [ ] **No `--list` or `--current` subcommand**.

---

## Remaining gaps — App-level

### Destination suggestion quality

- [ ] **`defaultFlightHours()` in suggest route is now partially redundant** — It's used as the last-resort fallback when `estimateFlightHours()` returns null (city not in table) AND the AI returned null/NaN. The heuristic matches by keyword in the *destination city name* (e.g. `isAsia` tests for "thailand" in the city string, which won't match "Bangkok"). This path is rarely hit but when it is, the heuristic is unreliable.
- [ ] **AI can still return cities not in the coordinate table** — If maxTravelHours is set and the AI suggests "Dubrovnik" from "Shanghai", the system can't independently verify whether it's reachable. The prompt reference examples help prevent this, but aren't a guarantee.
- [ ] **No re-generation when all destinations are filtered out** — If `correctAndFilterByTravelTime` removes all 4-6 suggestions (because the AI ignored the constraint), the user gets an empty result. Should detect this and re-prompt with stricter instructions.

### DestinationCard live data fetching

- [ ] **Parallel API calls per card** — Each card independently fires `/api/trains` and `/api/hotels`. With 6 destinations, that's 12 fetch calls on page load. Should batch or debounce.
- [ ] **No loading state for train/hotel estimates** — The static values render immediately, then get replaced by live values. This causes a content flash when live data arrives (numbers change in-place).
- [ ] **Train fetch only fires if `staticTrainEstimate` is truthy** — This means live train data is never fetched for non-European routes. If hafas-client could find a route (e.g. some Asian high-speed rail is in DB's system), it would be missed.

### Budget recalculation

- [ ] **Budget slider pre-set still uses static `getAccomEstimate()`** — After "Compare All" flight prices, the budget slider anchors accommodation to the static estimate. It could instead use the live hotel price from `/api/hotels` if available.

---

## Completed (this session — medium priority)

- [x] **Scraper: retry wrapper for `fetch()`** — exponential backoff, 3 attempts
- [x] **Scraper: `parse_llm_json_array()` shared helper** — validates `name` field, normalizes enum values
- [x] **Scraper: OSM Overpass switched to POST** — avoids URL length limits
- [x] **Scraper: single DB connection per city** — `with closing(get_db())`, passed to `process_city()`
- [x] **Scraper: `executemany` for trending updates** — batch update instead of row-by-row
- [x] **Scraper: `normalize_name()` for deduplication** — unicode normalization, accent stripping, whitespace collapse
- [x] **Scraper: rate limit between LLM calls** — 2-3s delays between Wikivoyage/YouTube extraction
- [x] **Scraper: dead `HEADERS` dict removed** — per-call headers only
- [x] **Kiwi: `flexDays` support** — date range widened by user's flexibility setting for cheaper flights
- [x] **Hotels: hotel ID cache** — 24h TTL per city, halves Amadeus quota usage
- [x] **Trains: station ID pre-mapping** — 30 major European stations, avoids fuzzy search latency
- [x] **Flight time: coordinate table expanded** — added ~35 cities (Balkans, Baltics, Southern Europe, East/SE Asia expanded)

## Remaining items

| Priority | Area | Issue | Effort |
|----------|------|-------|--------|
| ~~1~~ | ~~Scraper~~ | ~~Trending signals (TikTok/IG) likely broken~~ — Replaced with Wikipedia Pageviews API | Done |
| ~~2~~ | ~~Scraper~~ | ~~YouTube video ID extraction fragile~~ — Replaced with yt-dlp `ytsearch:` | Done |
| ~~3~~ | ~~Trains~~ | ~~Only DB profile~~ — Added OeBB + SNCB profile fallback | Done |
| ~~4~~ | ~~Hotels~~ | ~~Hostel estimate is synthetic~~ — Uses static table + tiered regional multiplier | Done |
| ~~5~~ | ~~Hotels~~ | ~~`cityToIataCode()` coverage~~ — Merged with airports.ts + 15 new cities | Done |
| 6 | Suggestions | `defaultFlightHours()` heuristic still present as last-resort (rarely hit) | Low |
| 7 | init_db.py | Brittle migration tracking — add `schema_version` table | Low |
| 8 | choose-ai-provider.js | Strips blank lines, no quoted value support | Low |
| 9 | Geocoding | Persist Nominatim results to SQLite for growing coverage | Small |
