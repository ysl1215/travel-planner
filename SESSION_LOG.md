# Travel Planner AI — Session Log

## Session 2026-06-26

### Overview
Backlog review + two small, surgical changes. End state: tsc clean, **128/128 tests** (123 baseline + 5 new), no production logic touched beyond the new provider wiring.

### 1. Geocode sanity-check validation (carried-over "still to validate")
The hallucinated-flight-time guard (`sanityCheckFlightHours`, `lib/flightTime.ts`) was never specifically exercised. Traced the real guard chain in `app/api/suggest/route.ts:64-82` (static table → Nominatim geocode → country-region sanity check — the last link is what fires for an *obscure* destination city) and added 5 tests to `flightTime.test.ts`:
- The `claimedHours < minHours * 0.7` trigger boundary, both sides (London→Japan 6h corrected, 7h trusted).
- The reverse-direction region-pair fallback (`flightTime.ts:432`) via London→Morocco.
- **The headline case:** an obscure dest city absent from `CITY_COORDS` (Kanazawa) is still caught because the region is derived from the *country* ("Japan"), not the city.
- The one documented blind spot: no region-pair in either direction (Delhi→Kenya) → uncorrectable; acceptable since an uncorrected value just isn't filtered.

### 2. Added Amazon Nova as a fallback provider
Nova is OpenAI-compatible, so this was config-shaped, not new machinery — mirrored the `lib/agnes.ts` wrapper exactly.
- **`lib/nova.ts`** (new) — thin config wrapper over `lib/openaiCompatProvider`. Base `https://api.nova.amazon.com/v1`, Bearer `NOVA_API_KEY`, default model `nova-pro-v1`.
- **`lib/ai.ts`** — chain is now `agnes → nova → openrouter → gemini → local` (Agnes still primary); added the `nova` case to both `generate` and `stream` switches.
- **`scripts/choose-ai-provider.js`** — added `nova` to the valid list + its `NOVA_API_KEY` hint.
- **`.env.local.example` + `README.md`** — documented the Nova block, env table rows, provider-order header, tech-stack line, and file-tree.
- **Decision — default `nova-pro-v1`:** the shared `NOVA_API_KEY` can invoke `nova-premier-v1`/`nova-pro-v1`/`nova-lite-v1`/`nova-micro-v1`/`nova-2-lite-v1`; `nova-2-pro-v1` and the bare `novapremier` alias 404, so they're avoided. Overridable via `NOVA_MODEL`.
- **No `nova.test.ts`** — there's deliberately no `agnes.test.ts`/`openrouter.test.ts`; the wrappers are pure config and `openaiCompatProvider.test.ts` carries the engine coverage. Matched the convention.
- **Not done — live Nova call.** No real key on hand (placeholder in the request), and `api.nova.amazon.com` needs sandbox-disable + user OK. Same "first live call" gate as Duffel.

### 3. LLM token metering — v1 (non-streamed), applied
Applied the cross-project metering changeset (`/shared/user/llm-metering-changesets/`). All five projects write one shared Supabase `token_usage` table tagged by `project`; this is the TS port.
- Added `lib/llmBudget.ts` + `lib/tokenUsageDb.ts` (drop-in from the bundle), installed `pg` + `@types/pg`.
- Hook in `lib/openaiCompatProvider.ts`: fire-and-forget `void logUsage(...)` on **both** `generate()` success paths (primary + 429-retry). apply.sh's blind meter-call guess SKIPped (real engine returns content from `data`, not a `{text,usage,provider,model}` object), so placed by hand inside the `attempt` callback where `data.usage` lives. Imports relocated from the appended bottom to the top.
- **v1 scope decision (user): chat `stream()` is NOT metered** — documented with a code comment. OpenAI-compat SSE drops `usage` unless you set `stream_options:{include_usage:true}` and parse the terminal chunk. Under-counts, never mis-counts.
- Threaded `taskType` through `ai.ts` + 7 call sites (suggest / suggest_retry / suggest_preference_retry / itinerary / constraint_reprompt / airport_code / json_fix) so the cost view splits by operation.
- No-op without `DATABASE_URL` (tests/local stay silent). Agnes=$0; Nova/OpenRouter/Gemini priced. tsc clean, 128/128, `next build` exit 0. NOT committed; no live DB run yet.

**When to upgrade to full streaming coverage (the answer to "how do we know?"):** don't guess — let v1 tell you. After it runs in prod with a live `DATABASE_URL`, run:
```sql
SELECT task_type, count(*), sum(prompt_tok+completion_tok) AS toks, round(sum(est_cost_usd),4) AS usd
FROM token_usage WHERE project='travel-planner' GROUP BY 1 ORDER BY toks DESC;
```
Chat is the ONLY un-metered surface, so it's the only blind spot. Upgrade to full streaming metering only if BOTH hold: (1) chat traffic is non-trivial (the app sees real chat usage, not just suggest/itinerary), and (2) the priced providers (not Agnes, which is $0) actually carry chat — i.e. Agnes is failing over to OpenRouter/Gemini on the chat path often enough to cost money. If the metered tasks already dominate cost, or chat rarely leaves Agnes ($0), v1 is sufficient and full coverage is wasted work. Rough proxy until then: chat is short, windowed to the last 10 messages, so per-call it's the lightest surface — the burden of proof is on chat volume.

### 4. Item 3 backlog (streaming token trim + multi-instance cache durability) — parked by user decision
Skipped both. Streaming `tokenCandidates` backs interactive chat where longer replies are the feature (the JSON `generate` path was already trimmed); cache durability is premature until a real multi-instance deploy (geocode L2 is already SQLite). Rationale recorded in SESSION_TODOS.md.

## Session 2026-06-24

### Overview
Two threads. (1) Shipped the deferred multi-city route-optimizer **UI** (Phase C). (2) A three-bucket **performance & cleanup pass** over code accumulated across the prior two sessions — runtime latency, LLM token usage, and provider-layer dedup. End state: tsc clean, **123/123 tests** (104 baseline + 19 new), `next build` exit 0, and a full live smoke run via Agnes (suggest / itinerary / route-order / airport / chat-stream all 200).

### 1. Multi-city route optimizer UI (Phase C)
- `components/RoutePlanner.tsx` — standalone, collapsible tool on the planning form. City chips (add/remove, case-insensitive dedup), optional start/end anchor selects, calls `/api/route-order`, renders ordered route + per-leg segments + total hours + unresolved-fallback warnings.
- Wired into `app/page.tsx` behind a `showRoutePlanner` toggle below `TripPlannerForm`. **Decision:** kept standalone rather than threading `knownCities` through `TripPlannerInput` and the suggest→itinerary state machine — the endpoint stands alone, so a standalone tool is the surgical choice.

### 2. Performance & cleanup pass

**Bucket 1 — runtime latency**
- **Geocode cliff:** `buildCostMatrix` geocoded every city *pair* serially with a 1.1s stagger that fired even on cache hits. Added `warmGeocodeCache(cities)` to `lib/flightTime.ts` (geocode unique cities once) and moved the rate-limit gate *inside* `geocodeCity` so cache hits never wait. Live: route-order ~17s→~4s cold (6 cities), 0.008s warm. `correctAndFilterByTravelTime` in suggest de-serialized the same way.
- **Itinerary response cache:** new `lib/ttlCache.ts` (bounded TTL + evict-oldest); wired 10min/50-LRU into `app/api/itinerary/route.ts` keyed on destination+input+budgetSplit. Live: 37.7s→0.004s on identical re-request.
- **Airport cache:** `/api/airport` AI fallback now cached (7.1s→0.003s). **Bounded caches:** prices/trains/hotels Maps were unbounded; now use `ttlCache`.

**Bucket 2 — token usage**
- Trimmed the itinerary example JSON to a type-skeleton (schema already enforced by Ajv). Rewrote the constraint re-prompt to diff-style (prior JSON + violations, not full prompt+context). Attraction context scales `min(20, tripDays*5)`. Suggest budget 4096→2048. Destination schema example deduped to one `DESTINATION_SCHEMA_EXAMPLE` constant.

**Bucket 3 — provider-layer dedup**
- Merged `agnes.ts` + `openrouter.ts` (~300 near-identical lines each) into a shared engine `lib/openaiCompatProvider.ts` (model loop + token descent + 402-continue + 429 backoff + SSE parse). Both are now ~50-line config wrappers; OpenRouter's richer error inspection + attribution headers preserved via config.
- 3 TTL failure-blacklists → one `lib/healthCache.ts`.
- `gemini.ts` + `localModel.ts` routed through the shared model-loop (native request shapes kept) — **parity:** gained per-model health cache + 429 backoff (previously threw immediately on 429/404).
- Removed the duplicated "extended coverage" IATA block in `amadeus.ts` (verified pure dup of the `cityToAirport` fallback).

**Deliberately not done:** full single IATA-map merge (metro vs airport codes differ — wrong metro code silently breaks hotel search); de-exporting `pathCost`/`checkReachability`/`hasCoordinates` and folding `defaultFlightHours` (all test-covered — would delete working coverage); the 4 pre-existing `app/page.tsx` `any` eslint errors (confirmed unchanged); train-fetch `Promise.any` (not the hot path).

### Process notes
- Lost ~20 min to a stale-build trap: `npm start` serves the last `next build`, so early "timing tests" measured pre-change code. The §6 whack-a-mole trigger fired correctly; once caught, rebuild-then-test showed the real wins. Lesson saved to memory.
- New tests: `lib/__tests__/ttlCache.test.ts` (4), `healthCache.test.ts` (6), `openaiCompatProvider.test.ts` (9).

### Files
- **New:** `components/RoutePlanner.tsx`, `lib/ttlCache.ts`, `lib/healthCache.ts`, `lib/openaiCompatProvider.ts`, + 3 test files.
- **Rewritten:** `lib/agnes.ts`, `lib/openrouter.ts`, `lib/gemini.ts`, `lib/localModel.ts` (wrappers over the shared engine).
- **Modified:** `lib/ai.ts`, `lib/costMatrix.ts`, `lib/flightTime.ts`, `lib/prompts.ts`, `lib/attractionContext.ts`, `lib/amadeus.ts`, `app/page.tsx`, `app/api/{itinerary,suggest,airport,prices,trains,hotels}/route.ts`, README / IMPROVEMENTS / SESSION_TODOS.

---

## Session 2026-06-21

### Overview
Two threads. (1) Code-cleanup pass completing 4 backlog items. (2) Investigated 15 external GitHub repos
(3 + 12) for borrowable patterns, produced a consolidated implementation plan (`IMPLEMENTATION_PLAN.md`),
and implemented its highest-leverage item: a deterministic itinerary constraint validator.

### Cleanup items (start of session)
- **Geocode → SQLite persistence**: `geocode_cache` table in `init_db.py`; `flightTime.ts` `geocodeCity`
  now uses an L1 in-memory Map + L2 SQLite cache (`getCachedGeocode`/`saveGeocode` in `db.ts`). Transient
  network errors are not cached.
- **`defaultFlightHours()` cleanup**: replaced the ~30-line regex continent-pair heuristic with the
  great-circle `estimateFlightHours()` (fallback 6h). (The original to-do said "superseded by
  sanityCheckFlightHours" — imprecise; that function corrects a claim, can't produce a default.)
- **`init_db.py` migration tracking**: added a `schema_version` table + `SCHEMA_VERSION` constant,
  idempotent insert. Verified create + re-run.
- **`choose-ai-provider.js`**: now preserves blank lines/comments and matches quoted / `export` /
  whitespace-prefixed `AI_PROVIDER` assignments. Verified across 4 edge cases.
- Env note: mise python 3.13 lacks `_sqlite3`; use `/usr/bin/python3` (3.9) for any sqlite work.

### FlyAI (#5) reclassified — blocked, not buildable
`@fly-ai/flyai-cli` v1.0.16 is NOT a stdout-JSON CLI like `google_flights.py`; it's a streamable-HTTP
**MCP client** for Alibaba/Fliggy requiring `FLYAI_SIGN_SECRET` matching the Fliggy server (HMAC +
AES-256-GCM), ships device-fingerprint headers, and is published as an obfuscated bundle. Not installed
here despite the earlier note. Moved to "Blocked on third-party" — needs Fliggy MCP credentials + sign-off
before wiring an obfuscated fingerprinting bundle into a server route.

### Repo investigation (15 repos)
Evaluated through a "Half A (AI suggestion + price aggregation — the differentiator) vs Half B (itinerary
management — already mature)" lens. Full per-repo verdicts in the durable eval note and
`git-repo-investigation.md`; consolidated plan in `IMPLEMENTATION_PLAN.md`. Three high-value borrows:
1. **TravelPlanner (ICML'24)** — constraint-taxonomy → deterministic validator (implemented, below).
2. **travel-hacking-toolkit** — Duffel (official flight API, free dev tier) + LiteAPI as durable price
   sources over blocked-Kiwi/fragile fast-flights.
3. **ai-travel-agent** — LangGraph ReAct tool loop + human-in-the-loop review gate (concepts → TS).
Also surfaced: **fast-flights v3.0 (Jun 2026) is a breaking API change** + maintainer stepped back (issue
#92) — pin the version, don't blind-upgrade; Duffel is the durable fix.

### Implemented — Item 1: deterministic itinerary constraint validator
- **New `lib/itineraryConstraints.ts`** — pure, LLM-free `validateItineraryConstraints()` →
  `ConstraintReport { passed, finalPass, violations[] }`. Rules: hard (`day_count`, `day_array_length`,
  best-effort `budget`, `transport_mode`) + commonsense (`empty_day`, `duplicate_venue`, `wrong_city`,
  `within_sandbox`). Budget parse is best-effort to avoid false positives on free-text costs; venue
  matching is accent- and punctuation-insensitive.
- **`app/api/itinerary/route.ts`** — factored a single `respondWithItinerary()` helper (replaced 4
  duplicated success returns); runs the validator and, on hard violations, does ONE corrective re-prompt
  via `generate()` (kept only if it strictly reduces violations; any failure falls back to the original —
  never blocks delivery). `constraintReport` added to the response.
- **`app/page.tsx`** — amber "caveats to double-check" badge listing violation details above the itinerary.
- **Tests** — `lib/__tests__/itineraryConstraints.test.ts`, 18 cases (incl. `parseCost`, all-pass,
  false-positive guards). Full suite 79/79 pass; `tsc --noEmit` clean; `next build` exit 0.
- **Caveat**: the re-prompt LLM path is unverified live (project blocked on OpenRouter credits) but is
  fail-safe by construction.

### LIVE end-to-end validation via Agnes (2026-06-21) — passed, 3 bugs caught & fixed
With `AGNES_API_KEY` in `.env.local`, ran the full pipeline against the real API. Direct curl first
confirmed the API contract (HTTP 200, standard OpenAI shape `choices[0].message.content`, clean JSON).
Then, against `next start`:
- **Stage 1 — /api/suggest:** ✓ 5 nature destinations, all within the 4h limit, 0 wrongly deprioritised
  (with real UI category labels). **Finding:** `lib/preferenceMatch.ts` only matches exact UI category
  labels ("Hiking & Trekking"), not raw terms ("hiking") — works through the UI, but brittle. Logged,
  not fixed.
- **Stage 2 — /api/itinerary:** ✓ complete 3-day plan (15 activities), `constraintReport finalPass=true`.
- **Stage 3 — /api/chat (streaming):** ✓ coherent streamed answer.

**Three real bugs the live run caught and I fixed:**
1. **`wrong_city` validator rule = pure noise** — `day.location` is a thematic title in practice
   ("Männlichen Ridge & Hidden Valleys") and day-trips are legitimate; the rule produced 12 false
   positives / 0 true positives on a coherent itinerary. **Removed** (with rationale comment + a
   regression test asserting day-trips aren't flagged).
2. **`day_count` nights-vs-days false positive** — Aug 10–13 is 4 inclusive days but 3 nights; the LLM
   consistently (and reasonably) returns 3 days. Strict inclusive-count flagged it every time.
   **Relaxed** to accept [nights, inclusiveDays].
3. **`AI_PROVIDER` didn't tolerate a comma-list** — `AI_PROVIDER=agnes,openrouter` became one bogus
   provider name ("Unknown AI provider"). **Fixed** via a shared `resolveProviders()` that splits both
   `AI_PROVIDER` and `AI_PROVIDER_ORDER`.
Also: **itinerary generation truncated at the default 4096-token ceiling** (a full plan's JSON is
larger), causing intermittent parse failures → raised the itinerary + constraint-re-prompt calls to
`tokenCandidates: [8192, 4096, 1024]`. Confirmed the re-prompt path fires (logs) but is fail-safe.
Post-fix: tsc clean, 104/104 tests, all three stages green.

### Added Agnes AI as the primary LLM provider (the OpenRouter-blocker unblock)
Agnes AI is OpenAI-compatible, so it slots into the existing multi-provider architecture.
- **New `lib/agnes.ts`** — mirrors `lib/openrouter.ts` (model-health cache, token-candidate fallback,
  429 backoff, OpenAI-style SSE streaming). Base `https://apihub.agnes-ai.com/v1` (override via
  `AGNES_BASE_URL`), `Authorization: Bearer`, default model `agnes-2.0-flash` (override via
  `AGNES_MODEL`/`AGNES_MODELS`). Reads `AGNES_API_KEY`.
- **`lib/ai.ts`** — registered `agnes` in both `generate` and `stream` switches; made it the **default
  primary** with chain **agnes → openrouter → gemini → local** (`DEFAULT_PRIMARY`/`DEFAULT_ORDER`).
  Non-destructive: existing OpenRouter/Gemini/Local keys still work as fallbacks. Override via
  `AI_PROVIDER` / `AI_PROVIDER_ORDER`.
- Updated `scripts/choose-ai-provider.js` (added `agnes` + `AGNES_API_KEY` hint), `.env.local.example`
  (Agnes as primary section), README (feature, env table + footnote, tech-stack).
- Verified: tsc clean, 103/103 tests, `next build` exit 0. **Live end-to-end validation pending the
  API key** (user adding to `.env.local`) — this is what finally exercises the suggest → itinerary →
  constraint-validator paths against a real model.

### Implemented — Item 4 (Phases A + B): route ordering engine
Built the isolated, fully-testable core of multi-city route ordering; **paused before Phase C** (the
net-new UI/flow) pending a product-direction decision.
- **Phase A — `lib/routeOrder.ts`** (pure, no I/O): open-path TSP. **Held-Karp exact DP for n ≤ 10**
  (seeds all start cities when start is free, so it's globally optimal), **nearest-neighbor + 2-opt**
  above that. Handles **asymmetric** cost matrices, **Infinity** = unavailable/infrequent leg (routes
  around it; returns Infinity cost + empty order when genuinely disconnected), and `fixedStart`/
  `fixedEnd` anchors (home/departure). 11 tests incl. brute-force optimality, asymmetric direction
  choice, Infinity detour, disconnect detection, anchors, and a 12-city heuristic case.
- **Phase B — `lib/costMatrix.ts`**: `buildCostMatrix(cities, {unavailable, unknownLegCost})` →
  asymmetric matrix seeded from `estimateFlightHoursAsync` (great-circle; Nominatim only for
  non-table cities, cached). Unavailable legs → Infinity (directional); unresolved legs → finite
  `unknownLegCost` (default 24h, NOT Infinity — an unknown leg shouldn't make the route unsolvable),
  reported in `unresolved[]`. 5 tests.
- Verified: tsc clean, 103/103 tests, full suite green.
- **Phase C — API route only** (UI deferred by choice): `app/api/route-order/route.ts` — POST
  `{cities, homeCity?, endCity?, unavailable?}` → `{order, segments (RouteSegment[]), totalHours,
  unresolved}`. Dedupes cities case-insensitively, anchors start/end to indices, returns 422 when the
  unavailable legs disconnect the graph, 400 on <2 cities. **Live-tested against `next start`:**
  London/Paris/Madrid/Rome → sensible order (5.2h); blocking London→Paris forced the London→Rome→Paris
  detour (4.4h); single city → 400. `next build` registers `/api/route-order`. UI (multi-city input
  mode + route display) remains deferred until the UX is wanted.

### Implemented — Item 3: Duffel flight provider
Added `lib/duffel.ts` — an official-flight-API client mirroring the `lib/kiwi.ts` contract
(`searchFlights(params) → {flights, error}` + `isConfigured()`), so it slots into the existing
provider-fallback chain. Inserted as the **primary** provider in `app/api/prices/route.ts`
`fetchWithFallback` (now **Duffel → Kiwi → fast-flights**), gated on `DUFFEL_API_TOKEN` (no-op when
unset; existing chain unchanged for current users). API contract verified against Duffel's official
docs: `POST /air/offer_requests?return_offers=true`, headers `Authorization: Bearer` + `Duffel-Version: v2`;
body `{data:{slices, passengers:[{type:"adult"}], cabin_class}}`; response `data.offers[]` with
`total_amount`(string)/`total_currency`/`owner.name`/`slices[].segments[]` (`departing_at`/`arriving_at`/
`duration` ISO-8601). Mapping notes: offers sorted cheapest-first (Duffel doesn't pre-sort), stops =
segments−1 on the outbound slice, ISO-8601 durations summed → "Xh Ym", `premium-economy` → `premium_economy`,
`flexDays` ignored (no native flex search). 8 fetch-mocked unit tests (`lib/__tests__/duffel.test.ts`).
Env documented in `.env.local.example` + README env table + feature bullets + tech-stack row.
Verified: tsc clean, 87/87 tests, `next build` exit 0. (No live call — no Duffel token available.)

### Implemented — Item 2: fast-flights hardening
Diagnosed `scripts/google_flights.py`: it uses the fast-flights **2.x** API
(`get_flights(flight_data=[FlightData(...)], trip=..., seat=..., passengers=..., fetch_mode=...)`).
fast-flights **3.0** (2026-06-13) is a breaking change to a `create_query`/`FlightQuery` API, and the
dependency was **unpinned** in 3 places (README ×2, Dockerfile) with no requirements file — so a fresh
build would pull 3.x and break the script. Fix: created `requirements.txt` pinning `fast-flights==2.2`
(last 2.x; verified against the v2.2 tag's README that it exposes the exact API used) + `yt-dlp`;
Dockerfile and README now install via `-r requirements.txt`; added breaking-change + maintainer-stepped-
back (#92) caveats in `requirements.txt`, the `google_flights.py` header, and the README fallback note.
Validated: requirement specifiers parse, script compiles, tsc clean. (No live run — fast-flights not
installed locally.) Durable fix remains Duffel (#3).

### Files modified / created
| File | Action |
|------|--------|
| `lib/agnes.ts` | New — Agnes AI provider (OpenAI-compatible, mirrors openrouter.ts) |
| `lib/ai.ts` | Registered `agnes` in both switches; default primary + chain |
| `app/api/route-order/route.ts` | New — multi-city ordering endpoint (engine wired, no UI) |
| `lib/routeOrder.ts` | New — pure open-path TSP optimizer (Held-Karp + NN/2-opt) |
| `lib/costMatrix.ts` | New — asymmetric cost-matrix builder (flight-hours seed + Infinity legs) |
| `lib/__tests__/routeOrder.test.ts` | New — 11 tests (brute-force optimality, asymmetric, Infinity, anchors) |
| `lib/__tests__/costMatrix.test.ts` | New — 5 tests |
| `lib/duffel.ts` | New — Duffel official flight API provider (mirrors kiwi.ts contract) |
| `lib/__tests__/duffel.test.ts` | New — 8 fetch-mocked tests |
| `app/api/prices/route.ts` | Duffel inserted as primary in fallback chain + docstring |
| `.env.local.example` | New `DUFFEL_API_TOKEN` (flight provider priority documented) |
| `requirements.txt` | New — pins `fast-flights==2.2` (+ yt-dlp) with breaking-change rationale |
| `Dockerfile` | Install Python deps via `-r requirements.txt` |
| `scripts/google_flights.py` | Header note: bound to 2.x API, do not bump to 3.x |
| `lib/itineraryConstraints.ts` | New — constraint validator |
| `lib/__tests__/itineraryConstraints.test.ts` | New — 18 tests |
| `app/api/itinerary/route.ts` | `respondWithItinerary` helper + validator wiring + re-prompt |
| `app/page.tsx` | constraint-warnings state + caveats badge |
| `lib/flightTime.ts` | L1/L2 geocode cache |
| `lib/db.ts` | `getCachedGeocode` / `saveGeocode` |
| `scripts/init_db.py` | `geocode_cache` + `schema_version` tables |
| `scripts/choose-ai-provider.js` | blank/comment/quote-safe rewrite |
| `app/api/suggest/route.ts` | `defaultFlightHours` → `estimateFlightHours` |
| `IMPLEMENTATION_PLAN.md` | New — 4-item plan from repo investigation |
| `README.md`, `IMPROVEMENTS.md`, `SESSION_TODOS.md` | Doc updates |

---

## Session 2026-05-24

### Overview
Major quality, reliability, and performance improvements. Added preference matching to fix mismatched destination suggestions, geocoding sanity checks to catch hallucinated flight times, response caching, test suite, and expanded data coverage. Researched 10 external repos for integration opportunities. Attempted end-to-end testing (pipeline works but free-tier models are rate-limited — needs paid credits).

### End-of-Session Testing Status
- Pipeline validated: server starts, loads env, tries models in fallback order
- Model health cache works (blacklists failed models with correct TTL)
- OpenRouter free tier unreliable: Llama 3.3 (429), DeepSeek V4 (402), Nemotron (slow/unparseable)
- **Next step:** Add $5 OpenRouter credits, use `deepseek/deepseek-chat` as primary model
- fast-flights (Google Flights scraper) installed as flight price fallback
- flyai-cli (Fliggy/Alibaba) installed for China-centric inventory

### External Repo Investigation
Assessed 10 repos (full findings in `git-repo-investigation.md`). Key takeaways:
- **travel-mcp-server**: Amadeus flight search + airport intelligence API (VERY HIGH relevance)
- **travel-hacking-toolkit**: Multi-source pricing — Skiplagged, Airbnb, Trivago (HIGH)
- **tripper**: SSE progress streaming, multi-LLM task routing (HIGH)
- **TripCraft**: Spatio-temporal itinerary validation (HIGH)
- **ChinaTravel**: Composable constraint pipeline / LLM-Modulo pattern (HIGH)
- **ai-travel-agent**: Email export, SerpAPI, human-in-the-loop (HIGH)

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
