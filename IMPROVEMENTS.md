# Improvement Opportunities

> Last updated: 2026-06-26

---

## Addressed 2026-06-26 (LLM token metering — v1)

- [x] **Runtime LLM token/cost metering** — applied the cross-project changeset (shared Supabase `token_usage`, `project="travel-planner"`). Added `lib/llmBudget.ts` + `lib/tokenUsageDb.ts`, installed `pg`/`@types/pg`, hooked `logUsage` into both `generate()` success paths in `openaiCompatProvider.ts`, threaded `taskType` through 7 call sites. **v1 = non-streamed only** (chat `stream()` left un-metered with a code comment — under-counts, never mis-counts). No-op without `DATABASE_URL`. tsc/tests/build clean. Not committed; no live-DB run yet. Upgrade-to-full-streaming trigger documented in SESSION_LOG.

## Addressed 2026-06-26 (validation + Nova provider)

- [x] **Geocode sanity-check never exercised** — added 5 tests to `flightTime.test.ts` pinning the `sanityCheckFlightHours` guard's real decision boundary (`claimedHours < minHours * 0.7`, both sides), the reverse-direction region-pair fallback, the obscure-city-via-country headline case (Kanazawa caught through "Japan"), and the one documented blind spot (no region-pair either direction, e.g. Delhi→Kenya — uncorrectable, acceptable). 128/128 green.
- [x] **Added Amazon Nova as a fallback provider** — `lib/nova.ts` (thin config wrapper over `lib/openaiCompatProvider`, mirrors `agnes.ts`); chain now `agnes → nova → openrouter → gemini → local` with Agnes still primary. Default model `nova-pro-v1`; documented in README + `.env.local.example` + `choose-ai-provider.js`. Live call deferred (no real key yet; same gate as Duffel).
- **Parked (user decision):** streaming token-loop trim (backs interactive chat, not an obvious win) and multi-instance cache durability (premature; geocode L2 already SQLite).

---

## Addressed 2026-06-24 (multi-city UI + performance & cleanup pass)

A three-bucket pass over code accumulated across the prior two sessions. tsc clean, **123/123 tests** (104 baseline + 19 new), `next build` exit 0, full live smoke via Agnes (suggest / itinerary / route-order / airport / chat-stream all 200).

**Multi-city route optimizer UI**
- [x] **Route-ordering engine had no UI (Phase C deferred)** — Added `components/RoutePlanner.tsx`: a standalone, collapsible tool on the planning form. Add/remove city chips, optional start/end anchors, calls `/api/route-order`, renders the ordered route + per-leg segments + total hours + unresolved-fallback warnings. Deliberately not threaded through the suggest→itinerary state machine (the endpoint stands alone).

**Bucket 1 — runtime latency**
- [x] **O(n²) geocode cliff in `buildCostMatrix`** — every city *pair* was geocoded serially with a 1.1s stagger that fired even on cache hits. Added `warmGeocodeCache()` (`lib/flightTime.ts`) to geocode unique cities once, and moved the rate-limit gate *inside* `geocodeCity` so cache hits never wait. Route-order: ~17s→~4s cold (6 cities), **0.008s warm** (live-measured). Suggest geocoding de-serialized the same way.
- [x] **Itinerary route had no response cache (most expensive call, 8192-token budget)** — Added `lib/ttlCache.ts` (bounded TTL cache) and wired a 10min/50-LRU cache into `app/api/itinerary/route.ts`, keyed on destination+input+budgetSplit. Live-measured **37.7s→0.004s** on identical re-request (byte-identical output).
- [x] **Airport-code AI fallback uncached** — `/api/airport` now caches resolved codes (7.1s→0.003s). It re-fired on every `tripInput` change client-side.
- [x] **Unbounded response caches (memory leak)** — prices/trains/hotels Maps had TTLs but no size cap; now bounded via the shared `ttlCache`.

**Bucket 2 — token usage**
- [x] **Itinerary example JSON taught the schema twice** — trimmed the ~600-700-token populated example to a type-skeleton (the JSON schema already enforces structure).
- [x] **Constraint re-prompt resent the full prompt + attraction context** — now diff-style (prior itinerary JSON + violation list), ~50% input cut on that path; existing fail-safe (only adopt if violations strictly reduced) preserved.
- [x] **Fixed attraction-context size regardless of trip length** — `maxItems` now scales `min(20, tripDays*5)`.
- [x] **Over-provisioned suggest budget** — 4096→2048 (4-6 destinations ≈ 800-1200 output tokens).
- [x] **Destination schema example duplicated in 3 prompts** — extracted to one `DESTINATION_SCHEMA_EXAMPLE` constant in `lib/prompts.ts`.

**Bucket 3 — dead code / dedup**
- [x] **`agnes.ts` and `openrouter.ts` were ~300 lines of near-identical code** — merged into a shared OpenAI-compatible engine (`lib/openaiCompatProvider.ts`: model loop + token descent + 402-continue + 429 backoff + SSE parse). Both are now ~50-line config wrappers (openrouter 351→~85 lines). OpenRouter's richer error-body inspection and attribution headers preserved via config.
- [x] **3 hand-rolled TTL failure-blacklists** (ai.ts per-provider + agnes/openrouter per-model) — consolidated into one `lib/healthCache.ts`.
- [x] **Gemini + Local lacked the health cache / 429 backoff the others had** — routed both through the shared model-loop (`runWithDescentAndHealth`), keeping their native request shapes. Behavioral change: they previously threw immediately on 429/404; now they retry 429 with backoff and blacklist on 402/404.
- [x] **Two hand-synced IATA tables** — removed the redundant "extended coverage" block in `amadeus.ts` (verified pure duplication of the `cityToAirport` fallback). Did **not** do a full single-map merge — metro codes (LON) vs airport codes (LHR) differ and a wrong metro code silently breaks hotel search; the risk outweighs the cosmetic gain.
- Deviation: kept `pathCost` / `checkReachability` / `hasCoordinates` exported and `defaultFlightHours` inline — they're each covered by passing unit tests, so de-exporting would delete working coverage for harmless utilities.

## Addressed 2026-06-21

- [x] **No way to order a known set of cities into an optimal multi-city route** (Phases A+B) — Added `lib/routeOrder.ts` (pure open-path TSP: Held-Karp exact ≤10 cities, nearest-neighbor+2-opt above; asymmetric costs, Infinity for unavailable/infrequent legs, start/end anchors) and `lib/costMatrix.ts` (builds the asymmetric matrix from great-circle flight hours, marks unavailable legs Infinity). 16 tests incl. brute-force optimality checks. Phase C: the `app/api/route-order` endpoint is now wired and live-tested (cities in → ordered route + segments out, routes around unavailable legs); only the UI (multi-city input mode + route display) remains deferred.
- [x] **No durable flight-price source (Kiwi signup discontinued, fast-flights is a fragile pinned scraper)** — Added a Duffel official-flight-API provider (`lib/duffel.ts`) mirroring the Kiwi contract, inserted as the primary in the `prices/route.ts` chain (Duffel → Kiwi → fast-flights), gated on `DUFFEL_API_TOKEN` so it's a no-op until configured. API shape verified against Duffel's official docs. 8 fetch-mocked unit tests; tsc + `next build` clean.
- [x] **fast-flights fallback exposed to a breaking upstream change** — `scripts/google_flights.py` uses the fast-flights 2.x API, but the dependency was unpinned in 3 places (README ×2, Dockerfile), so a fresh build would pull 3.x (breaking `create_query`/`FlightQuery` API; upstream maintainer stepped back, issue #92). Created `requirements.txt` pinning `fast-flights==2.2` (verified as the last 2.x release exposing the API the script uses); Dockerfile + README now install via `-r requirements.txt`; added breaking-change/maintainer caveats in 3 spots. Durable fix is an official flight API (Duffel) — `IMPLEMENTATION_PLAN.md` #3.
- [x] **Live validation via Agnes (2026-06-21)** — full pipeline (suggest → itinerary + constraint validator + re-prompt → chat streaming) confirmed working end-to-end against the real API. Caught + fixed 3 bugs: removed the noisy `wrong_city` rule (12 false positives, 0 true), relaxed `day_count` for the nights-vs-days ambiguity, fixed `AI_PROVIDER` comma-list parsing, and raised the itinerary token budget to 8192 (default 4096 truncated full-plan JSON).
- [x] **Itineraries pass individual checks but fail their conjunction** (TravelPlanner ICML'24 finding) — Added a deterministic, non-LLM post-generation constraint validator (`lib/itineraryConstraints.ts`): hard constraints (day-count vs date span, best-effort budget, allowed transport modes) + commonsense rules (no empty days, no duplicate venues, right-city activities, no hallucinated attractions vs the index). Wired into `app/api/itinerary/route.ts` (`respondWithItinerary`) with a fail-safe single corrective re-prompt on hard violations; `constraintReport` returned in the response and surfaced as an amber caveats badge in `app/page.tsx`. 18 unit tests; tsc + `next build` clean. NOTE: the re-prompt LLM path is unverified live (blocked on OpenRouter key) but fail-safe (falls back to original, never blocks delivery).

## Addressed earlier (pre-2026-06-21)

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
