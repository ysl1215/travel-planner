# Travel Planner AI — Session Log

## Session 2026-05-24

### Overview
Major quality, reliability, and performance improvements. Added preference matching to fix mismatched destination suggestions, geocoding sanity checks to catch hallucinated flight times, response caching, test suite, and expanded data coverage.

### Changes Implemented

**Infrastructure**
- Initialized git repository (`main` branch, initial commit + 2 feature commits)
- Added Vitest test suite (61 unit tests across 7 modules)
- Added `test` and `test:watch` scripts to package.json
- Added test step to GitHub Actions CI workflow

**Preference Matching (new: `lib/preferenceMatch.ts`)**
- Keyword-based scoring: scans vibeMatch/highlights/rationale against liked/disliked activities
- 16 activity categories mapped to signal words (nightlife, hiking, beach, etc.)
- Generic tourist city list for `preferHiddenGems` penalty
- `scoreAndSortDestinations()` separates matched (score > 0) from deprioritised (score ≤ 0)
- Re-prompt logic: if < 3 good matches, asks AI for replacements with stricter constraints
- UI: amber warning badge + reduced opacity on deprioritised destination cards

**Geocoding Reliability (`lib/flightTime.ts`)**
- Country-based sanity check (`sanityCheckFlightHours`): catches hallucinated flight times using region-pair minimum hours table (e.g. Asia→Europe minimum 9h)
- Parallelised Nominatim geocoding (staggered 1.1s instead of sequential)
- Fixed bounding-box region inference (East Asia lat threshold 35→20 to cover Shanghai, etc.)
- 70+ countries mapped to regions for validation

**Prompt Improvements (`lib/prompts.ts`)**
- HARD RULES section: explicitly forbids destinations matching disliked activities
- vibeMatch instruction: must contain user's liked activities
- Smarter flight time references: skips cities > 2.5x maxTravelHours (saves tokens)

**Latency & Token Optimisation**
- Response cache in suggest route (10min TTL, 50 entries, keyed on input hash)
- Temperature 0.2 for JSON correction calls (more deterministic)
- Temperature parameter threaded through `generate()` → OpenRouter provider

**Data Coverage Expansion**
- IATA map merge: `amadeus.ts` now falls back to `airports.ts` (~15 additional cities)
- hafas profile fallback: DB → OeBB → SNCB for broader European train coverage
- Static accommodation table expanded with ~20 cities (Balkans, Baltics, SEA, Iceland, Morocco, NZ)
- Hostel estimate: uses curated static prices instead of synthetic `cheapest * 0.4`
- Station IDs added for OeBB/SNCB networks

**UI Improvements**
- Loading indicators (Loader2 spinner + opacity transition) for train/hotel estimates
- ErrorBoundary wrapping destination card grid
- Preference warning badge on deprioritised destinations

### Files Modified/Created

| File | Summary |
|------|---------|
| `lib/preferenceMatch.ts` | New — preference scoring and sorting |
| `lib/__tests__/preferenceMatch.test.ts` | New — 11 tests for preference matching |
| `lib/__tests__/flightTime.test.ts` | Added 6 sanity check tests |
| `lib/__tests__/airports.test.ts` | New — 6 tests |
| `lib/__tests__/amadeus.test.ts` | New — 8 tests (IATA + hostel estimate) |
| `lib/__tests__/hafas.test.ts` | New — 2 tests |
| `lib/__tests__/sanitize.test.ts` | New — 9 tests |
| `lib/__tests__/rateLimit.test.ts` | New — 4 tests |
| `vitest.config.ts` | New — Vitest configuration |
| `components/ErrorBoundary.tsx` | New — React error boundary |
| `app/api/suggest/route.ts` | Preference filter, cache, sanity check integration |
| `lib/flightTime.ts` | Country-region maps, sanity check, parallel geocoding |
| `lib/prompts.ts` | HARD RULES, token optimisation |
| `lib/amadeus.ts` | IATA merge, hostel estimate fix |
| `lib/hafas.ts` | Multi-profile fallback |
| `lib/accomEstimates.ts` | ~20 new cities |
| `lib/ai.ts` | Temperature in GenerateOpts |
| `lib/aiFix.ts` | Temperature 0.2 for corrections |
| `lib/openrouter.ts` | Temperature parameter support |
| `lib/types.ts` | `preferenceWarning` field on Destination |
| `components/DestinationCard.tsx` | Warning badge, loading states |
| `app/page.tsx` | ErrorBoundary wrapper |
| `.github/workflows/ci.yml` | Test step added |
| `package.json` | Vitest devDeps, test scripts |

---

## Session 2026-05-23

### Overview
Fixed two P1 scraper reliability issues: replaced broken social media trending signals with Wikipedia Pageviews API, and eliminated fragile YouTube HTML regex scraping in favour of yt-dlp built-in search.

### Changes Implemented

**Trending signals — Wikipedia Pageviews API (replaces TikTok + Instagram)**
- Removed `_extract_tiktok_views()` and `_extract_instagram_posts()` — both broken (auth/bot detection)
- New `_normalize_wiki_title()`: converts attraction names to Wikipedia URL path segments
- New `_fetch_wikipedia_pageviews(title, months=3)`: fetches 3-month total from Wikimedia REST API
- Rewritten `fetch_trending_scores()`: uses Wikipedia pageviews, 0.5s polite delay, caps at 15 attractions (up from 10)
- Existing thresholds in `attractionContext.ts` work without modification (Eiffel Tower=778k, Louvre=196k naturally fit >500k/>100k buckets)
- Verified: API is free, stable (since 2015), returns absolute view counts, 100 req/s allowed

**YouTube video ID extraction — yt-dlp search (replaces HTML regex)**
- Removed `_extract_video_ids()` — used fragile `"videoId":"..."` regex on YouTube search HTML
- New `_search_video_ids_ytdlp(query, max_ids)`: uses `ytsearch8:` + `--flat-playlist --get-id`
- Removed `YT_SEARCH_URL` constant and `fetch()` call to YouTube HTML
- Same graceful degradation: returns `[]` if yt-dlp unavailable

### Files Modified

| File | Summary |
|------|---------|
| `scripts/scrape_attractions.py` | Replaced TikTok/IG with Wikipedia pageviews; replaced HTML regex with yt-dlp search |
| `scripts/init_db.py` | Updated trending_score column comment |
| `README.md` | Updated trending signal references (4 locations) |
| `SESSION_TODOS.md` | Marked items 1 and 2 as done |
| `IMPROVEMENTS.md` | Marked trending signals and YouTube scraping as resolved |

---

## Session 2026-05-12

### Overview
Replaced all three external data sources (flights, trains, hotels) with reliable APIs + fallback architecture. Fixed the core "destinations ignore travel time constraint" bug with independent great-circle validation + Nominatim geocoding. Rewrote the attraction scraper for reliability. Batched frontend API calls for performance.

### Changes Implemented

**Flight prices — Kiwi.com Tequila API (primary) + fast-flights fallback**
- Created `lib/kiwi.ts`: Kiwi.com search with retry, backoff, flex-date support
- Rewrote `app/api/prices/route.ts`: Kiwi primary → fast-flights fallback, same cache/response shape
- Added `flexDays` support — Kiwi searches ± N days around target date for cheaper flights

**Train prices — hafas-client (live) + static fallback**
- Created `lib/hafas.ts`: live European rail search via DB HAFAS backend (no API key)
- 30 pre-mapped station IDs for common cities (avoids fuzzy search latency)
- Created `app/api/trains/route.ts`: live → static fallback, 1h cache
- Type declarations: `lib/hafas-client.d.ts`

**Hotel prices — Amadeus Hotel Search (live) + static fallback**
- Created `lib/amadeus.ts`: OAuth2 token management, hotel search, hotel ID caching (24h TTL)
- Created `app/api/hotels/route.ts`: live → static fallback, 30m cache
- Hotel ID cache halves Amadeus quota usage per city

**Flight time validation — independent great-circle distance**
- Created `lib/flightTime.ts`: 135+ city coordinate table, haversine calculation, Nominatim geocoding fallback
- `estimateFlightHours()` (sync, static table) + `estimateFlightHoursAsync()` (with geocoding)
- `correctAndFilterByTravelTime()` in suggest route: overrides AI-claimed flight hours with independent calculation
- Prompt now includes reference flight times with ✓/✗ markers as calibration for the LLM
- Re-prompt logic: if all destinations filtered out, re-prompts AI with strict geographic constraints

**Scraper rewrite (`scripts/scrape_attractions.py`)**
- `fetch()` now retries 3x with exponential backoff + jitter
- `parse_llm_json_array()` shared helper: strips fences, validates `name`, normalizes enums
- `normalize_name()` for unicode-aware deduplication (accent stripping, whitespace collapse)
- OSM Overpass switched to POST (avoids URL length limits)
- Single DB connection per run via `with closing(get_db())`
- `executemany` for batch trending score updates
- Rate limiting (2-3s) between LLM calls to avoid free-tier 429s
- Removed dead module-level `HEADERS` dict

**Frontend batching**
- Parent-level `useEffect` fetches train + hotel estimates for all destinations in parallel
- Results passed down as `prefetchedTrainEstimate` / `prefetchedHotelEstimate` props
- DestinationCard no longer fires independent fetch calls (12 → 2 batched requests)

**Documentation & configuration**
- `.env.local.example`: added `KIWI_API_KEY`, `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`, `AMADEUS_ENV`
- `README.md`: updated features, tech stack, and env vars tables
- `IMPROVEMENTS.md`: full tracker of all identified issues and their resolution status

### Files Created

| File | Purpose |
|------|---------|
| `lib/kiwi.ts` | Kiwi.com Tequila flight search client |
| `lib/flightTime.ts` | Great-circle flight time calculator (135+ cities + Nominatim fallback) |
| `lib/hafas.ts` | Live European train search via hafas-client |
| `lib/hafas-client.d.ts` | Type declarations for hafas-client |
| `lib/amadeus.ts` | Amadeus Hotel Search API client |
| `app/api/trains/route.ts` | Train prices endpoint |
| `app/api/hotels/route.ts` | Hotel prices endpoint |
| `IMPROVEMENTS.md` | Improvement tracker |

### Files Modified

| File | Summary |
|------|---------|
| `app/api/prices/route.ts` | Rewritten: Kiwi primary → fast-flights fallback + flexDays |
| `app/api/suggest/route.ts` | Async flight time validation, re-prompt on empty filter, `filterAndRespond` helper |
| `lib/prompts.ts` | Reference flight time examples injected into destination prompt |
| `components/DestinationCard.tsx` | Accepts prefetched train/hotel props, removed independent fetches |
| `app/page.tsx` | Batched train/hotel fetch effect, passes results to cards |
| `scripts/scrape_attractions.py` | Full rewrite: retry, validation, normalization, single DB connection |
| `.env.local.example` | Added Kiwi + Amadeus env vars |
| `README.md` | Updated features, tech stack, env vars |
| `package.json` | Added `hafas-client` dependency |

---

## Session 2026-05-09

### Overview
Completed all P2 hardening items + added personalisation features (free-text priorities, past trips calibration, anti-generic prompt rules) + integrated OpenStreetMap Overpass API for real trail/viewpoint/lake data.

### Changes Implemented

**P2.1 — Prompt injection sanitization**
- Created `lib/sanitize.ts`: strips control chars, removes injection patterns, caps length
- All three prompt builders now sanitize user inputs before injection

**P2.2 — YouTube non-English transcript fallback**
- `yt-dlp` now tries `en` → `en.*` → `all` languages
- LLM extraction prompt handles multilingual transcripts

**P2.3 — Scraper bot detection**
- 5 real browser user-agents, randomly rotated per request
- TikTok/Instagram delays increased to randomised 2–4s

**P2.4 — Itinerary correction loop caching**
- `aiFix.ts` caches correction results (keyed on first 100 chars + schema name)
- Same broken JSON returns cached result without LLM call

**Personalisation — Form + Prompt changes**
- Added `travelPriorities: string` (required) and `pastTrips?: string` to `TripPlannerInput`
- New "Your Travel Priorities" section in form with two textareas
- Both persist to localStorage under `travel_profile` key
- Destination prompt: priorities at top as highest-weight signal, pastTrips as calibration
- Anti-generic rules: no top-10 Google results, rationale must reference user priorities
- Itinerary prompt: priorities shape the entire itinerary, anti-checklist rules

**OSM Overpass Integration**
- New `fetch_osm_attractions(city, radius_km)` in scraper
- Geocodes via Nominatim (free, no key)
- Queries Overpass in 3 batches: viewpoints+peaks, lakes, hiking routes
- Uses `overpass.kumi.systems` primary, `overpass-api.de` fallback
- Extracts: name, type, difficulty (SAC scale), distance, estimated duration
- All OSM data gets `confidence: "high"`
- Pipeline order: Wikivoyage → OSM → YouTube → Save → Trending

### Files Modified/Created

| File | Action |
|------|--------|
| `lib/types.ts` | Modified — added `travelPriorities`, `pastTrips` |
| `lib/prompts.ts` | Modified — priorities injection, anti-generic rules, sanitization |
| `lib/sanitize.ts` | Created — prompt injection sanitization |
| `lib/aiFix.ts` | Modified — added correction cache |
| `lib/mockData.ts` | Modified — added `travelPriorities` to demo |
| `components/TripPlannerForm.tsx` | Modified — two textareas + localStorage |
| `scripts/scrape_attractions.py` | Modified — yt-dlp fallback, UA rotation, delays, OSM Overpass |

---

## Session 2026-04-06

### Overview
Completed P1 to-dos: npm install, Dockerfile fix for native module, YouTube transcript fix (yt-dlp).

---


- `BudgetSlider.tsx` uses `next/dynamic` with `ssr: false`

**Step 5 — Reduce token candidates**
- `generateWithOpenRouter`: `[4096, 2048, 1024, 512, 256, 128, 64, 32, 16, 8, 1]` → `[4096, 1024, 256]`
- `streamWithOpenRouter`: 10 candidates → `[2048, 512, 128]`

**Step 6 — Concurrency limit on flight scrapes**
- "Compare All" now processes destinations in batches of 3 instead of all at once

### Round 3: Token optimization (Steps 7–9)

**Step 7 — Truncate invalid JSON in aiFix.ts**
- Truncate to 500 chars before sending to correction model
- AJV error blobs replaced with human-readable schema hints
- Correction calls use `preferShortFirst: true`

**Step 8 — Chat sliding window**
- `messages.slice(-10)` before passing to `stream()`

**Step 9 — Lazy-load itinerary days**
- First 3 days shown; "Show all N days" button expands

### Round 4: Prompt quality (Steps 10–12)

**Step 10 — Prompt trimming**
- Destination prompt: ~60% token reduction, removed duplicate persona, verbose rules, full example JSON
- Itinerary prompt: replaced 1100-token multi-section prompt with compact inline schema template
- Chat system prompt: trimmed from ~150 to ~30 tokens per message
- Removed redundant `shortPrompt`/`expand` dual-path in itinerary route
- System prompt now carries flight-accuracy persona (not duplicated in user prompt)

**Step 11 — `defaultFlightHours()` heuristics**
- Replaced always-returning-4 with continent-pair heuristics (3h same-region → 13h trans-Pacific)

**Step 12 — Groq removed from comments**
- Stale "drop-in replacement for Groq" comment removed from `openrouter.ts`

### Round 5: Accuracy improvements (Steps 1–4 of second pass)

**Step 1 — Per-person budget fit**
- `cheapestPrice × adults` before comparing against `travelBudget`
- `sortedDestinations` sort also uses total cost

**Step 2 — Budget slider pre-set from real prices**
- After "Compare All", travel slice anchored to cheapest total flight cost
- Accommodation slice anchored to static estimate for cheapest destination
- Remaining budget distributed proportionally

**Step 3 — `preferHiddenGems` toggle**
- Added to `TripPlannerInput` type
- Toggle button in Optional Preferences section of form
- Wired into destination prompt (strong preference instruction)
- Wired into itinerary prompt (PRIORITY instruction)

**Step 4 — AI cost estimates flagged**
- `ActivityItem` cost renders as `~{cost}`
- Amber disclaimer banners on Itinerary, Attractions, and Food tabs

### Round 6: Transport + accommodation data (Steps 5–6)

**Step 5 — Static European train fares**
- `lib/trainFares.ts`: 60+ European cities, 40+ specific city-pair fares (EUR, advance)
- Generic intra-EU fallback (€30–80) for unlisted pairs
- `DestinationCard`: violet train estimate badge for European routes
- `originCity` prop added to `DestinationCard`

**Step 6 — Static accommodation estimates**
- `lib/accomEstimates.ts`: hostel / budget / mid-range nightly costs for 70+ cities (USD)
- `DestinationCard`: teal accommodation badge with per-night tiers + trip total
- Budget slider pre-set uses accommodation estimate for cheapest destination

### Round 7: Attraction index pipeline (Phases 1–4)

**Phase 1 — Pipeline foundation**
- `scripts/init_db.py`: SQLite schema (`attractions` + `scrape_queue` tables), WAL mode, migration support
- `scripts/scrape_attractions.py`: Wikivoyage fetch → LLM extraction → SQLite (stdlib only, no pip deps)
- `lib/db.ts`: shared Next.js DB access (`getAttractions`, `queueCity`, `isCityIndexed`, `getScrapeQueue`)
- `app/api/scrape-status/route.ts`: queue summary + per-city attraction counts
- Auto-queue: `destinationsResponse()` wrapper in `suggest/route.ts` queues all suggested cities

**Phase 2 — Prompt injection**
- `lib/attractionContext.ts`: relevance-scored context builder (scores by activity match, crowd level, confidence, trending)
- `buildItineraryPrompt` accepts optional `attractionContext` parameter
- `app/api/itinerary/route.ts`: loads attractions from DB, builds context, passes to prompt
- Response includes `indexed: bool` + `attractionCount: number`
- UI badge: "Enhanced with N local attractions" (green) or "No index yet — run scraper" (amber)

**Phase 3 — Cluster cards (half-day / full-day)**
- `lib/types.ts`: `ClusterOption` + `ItineraryCluster` interfaces; `clusters?: ItineraryCluster[]` on `TripItinerary`
- `lib/schemas/itinerary.schema.json`: `clusters` array with full nested schema (optional, not in `required`)
- `lib/prompts.ts`: clusters instruction — only generate when 2+ attractions share a geographic area
- `components/ClusterCard.tsx`: interactive option selector (Half day / Full day / etc.) with tradeoffs
- `components/ItineraryView.tsx`: renders cluster section at top of itinerary tab

**Phase 4 — YouTube + social signals**
- `scripts/scrape_attractions.py`: YouTube transcript extraction (public timedtext API, no key needed)
- `scripts/scrape_attractions.py`: TikTok + Instagram trending signal (hashtag page scraping)
- `trending_score` column added to `attractions` table (migration in `init_db.py`)
- `lib/db.ts`: `trending_score` added to `Attraction` interface
- `lib/attractionContext.ts`: `trending_score` factored into relevance scoring (penalises viral for hidden-gems users)

---

## Files Modified / Created

| File | Action | Summary |
|------|--------|---------|
| `app/api/chat/route.ts` | Modified | Fixed `streamWithOpenRouter` → `stream`, added rate limit, sliding window |
| `app/api/suggest/route.ts` | Modified | Added rate limit, `destinationsResponse()` auto-queue wrapper |
| `app/api/itinerary/route.ts` | Modified | Added rate limit, attraction index injection, `indexed` in response |
| `app/api/prices/route.ts` | Modified | Timeout 15s→30s (previous session) |
| `app/api/airport/route.ts` | Created | City → IATA with AI fallback |
| `app/api/scrape-status/route.ts` | Created | Scrape queue status endpoint |
| `app/page.tsx` | Modified | `useEffect` origin airport, budget pre-set, `itineraryIndexed` state, `originCity` prop |
| `components/TripPlannerForm.tsx` | Modified | `preferHiddenGems` toggle |
| `components/DestinationCard.tsx` | Modified | Per-person budget fit, train + accom estimates, `originCity` prop |
| `components/BudgetSlider.tsx` | Modified | Lazy-load recharts via `next/dynamic` |
| `components/BudgetPieChart.tsx` | Created | Extracted recharts pie chart |
| `components/ItineraryView.tsx` | Modified | Cluster section, lazy days, cost disclaimers |
| `components/ClusterCard.tsx` | Created | Half-day / full-day option selector |
| `lib/types.ts` | Modified | `preferHiddenGems`, `ItineraryCluster`, `ClusterOption`, `clusters` on `TripItinerary` |
| `lib/prompts.ts` | Modified | Trimmed all three prompts, `attractionContext` injection, clusters instruction |
| `lib/ai.ts` | Unchanged | — |
| `lib/openrouter.ts` | Modified | Token candidates reduced, exponential backoff on 429, stale comment removed |
| `lib/aiFix.ts` | Modified | Schema hints, 500-char truncation, `preferShortFirst` |
| `lib/rateLimit.ts` | Created | Sliding-window in-memory rate limiter |
| `lib/trainFares.ts` | Created | Static European train fare estimates |
| `lib/accomEstimates.ts` | Created | Static accommodation estimates (70+ cities) |
| `lib/db.ts` | Created | SQLite access layer for Next.js |
| `lib/attractionContext.ts` | Created | Relevance-scored attraction context builder |
| `lib/airports.ts` | Unchanged | — |
| `lib/schemas/itinerary.schema.json` | Modified | Added `clusters` array schema |
| `scripts/init_db.py` | Created | SQLite DB init + migration |
| `scripts/scrape_attractions.py` | Created | Full scraper: Wikivoyage + YouTube + trending → SQLite |
| `scripts/google_flights.py` | Unchanged | — |
| `scripts/choose-ai-provider.js` | Unchanged | — |
| `data/.gitignore` | Created | Ignores `attractions.db` |
| `package.json` | Modified | Removed unused deps, added `better-sqlite3` |
| `Dockerfile` | Modified | Node 20 + Python 3.11, single-stage |
| `README.md` | Modified | Full rewrite |

---

## Outstanding To-Dos (Priority Order)

### P1 — Must address before production

- [ ] **`better-sqlite3` native module** — requires compilation on deploy target. Add build step or switch to `@libsql/client` for edge compatibility. Test on Railway/Render before deploying.
- [ ] **Run `npm install`** — `better-sqlite3` and `@types/better-sqlite3` added to `package.json` but not yet installed in this environment.
- [ ] **Test full scraper with real API key** — dry-run confirmed Wikivoyage fetch works; LLM extraction + YouTube + trending not yet tested end-to-end with a live key.

### P2 — Quality & hardening

- [ ] **Prompt injection sanitization** — user text inputs (homeCity, likedActivities, etc.) passed directly into AI prompts without escaping.
- [ ] **YouTube transcript language fallback** — currently requests `lang=en` only. Add fallback to local language for non-English destinations.
- [ ] **Scraper bot detection** — TikTok/Instagram trending fetch may trigger bot detection. Add random user-agent rotation and longer delays between requests.
- [ ] **Itinerary correction loop token waste** — `aiFix.ts` re-prompt loop fires up to 3 times; consider caching first correction attempt.

### P3 — UX & polish

- [ ] **Loading states / Suspense** — app is a single large client component. Split into route segments with `loading.tsx`.
- [ ] **Dark mode** — CSS variables defined but app uses hardcoded light colors. Implement or remove.
- [ ] **Streaming path token candidates** — still tries up to 3 budgets × N models. Consider single attempt with generous budget for streaming.

### Future (next sessions)

- [ ] Travel blog scraping as additional attraction source (Phase 4 extension)
- [ ] Live train prices (Trainline/Eurail API) — currently static estimates only
- [ ] Interactive map (Leaflet + `route[]` array)
- [ ] Flexible date price heatmap
- [ ] Weather forecasts (Open-Meteo)
- [ ] Destination photos (Unsplash API — `imageQuery` field already on every `Destination`)
- [ ] User accounts + saved trips
- [ ] Hotel prices
- [ ] PWA / offline itinerary access
- [ ] Itinerary editing via chat (structured diff)
- [ ] Packing list generator
