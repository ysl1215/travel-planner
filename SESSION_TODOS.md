# Session To-Dos
> Last updated: 2026-06-26 (end of session)

## Completed 2026-06-26 (LLM token metering — v1, non-streamed)
- **Applied the cross-project token-metering changeset** (`/shared/user/llm-metering-changesets/`, `project="travel-planner"`, shared Supabase `token_usage`). Copied `lib/llmBudget.ts` + `lib/tokenUsageDb.ts`; installed `pg` + `@types/pg`.
- **Meter hook in `lib/openaiCompatProvider.ts`** — fire-and-forget `void logUsage(writeTokenUsage, …)` on BOTH success paths of `generate()` (primary `response.ok` + the 429-retry success — metering retries too). Imports moved to top (apply.sh had appended at bottom). `cfg.name`=provider, `candidate`=modelId, raw `data`=resp.
- **v1 scope decision (user): streaming NOT metered.** Only non-streamed `generate()` is metered (suggest/itinerary/constraint re-prompt/airport/json_fix). The chat `stream()` path is left un-metered with an explicit code comment — OpenAI-compat SSE omits `usage` without `stream_options:{include_usage:true}`. Under-counts, never mis-counts.
- **`taskType` threaded** through `ai.ts` `GenerateOpts` + 7 call sites: `suggest`, `suggest_retry`, `suggest_preference_retry`, `itinerary`, `constraint_reprompt`, `airport_code`, `json_fix`. Cost view breaks down by operation.
- **No-op safe:** `writeTokenUsage` no-ops when `DATABASE_URL` unset (local/tests record nothing, no error). Agnes=$0 (records token counts, cost 0); Nova/OpenRouter/Gemini priced. Table auto-creates lazily.
- tsc clean, 128/128 tests, `next build` exit 0. **NOT yet committed; not yet run with a live `DATABASE_URL`** (no rows in shared table until then).
- **Upgrade trigger for FULL streaming coverage:** once metering runs in prod, query `token_usage` for travel-planner — if non-chat token volume is the bulk, v1 is sufficient; only wire streaming if chat would materially change the cost picture (see SESSION_LOG for the exact test).

## Completed 2026-06-26 (validation + Nova provider)
- **Geocode sanity-check validation** — 5 new tests in `flightTime.test.ts` (trigger-threshold both sides, reverse region-pair fallback, obscure-city-via-country, the no-region-pair blind spot). 128/128.
- **Amazon Nova added as fallback provider** — `lib/nova.ts` thin wrapper over `lib/openaiCompatProvider` (mirrors agnes.ts); chain now `agnes → nova → openrouter → gemini → local`, Agnes still primary. Default model `nova-pro-v1` (avoid `nova-2-pro-v1`/`novapremier` — 404 on shared key). Wired into `ai.ts` (both switches), `choose-ai-provider.js`, README, `.env.local.example`. tsc clean. **Live call NOT yet done** (no real key; needs sandbox-disable + user OK).

## Completed 2026-06-24 (performance & cleanup pass)
Three-bucket pass over code accumulated in the prior 2 sessions. tsc clean, 123/123 tests (was 104 + 19 new), `next build` exit 0, full live smoke via Agnes (suggest/itinerary/route-order/airport/chat-stream all 200). Plan: ~/.claude/plans/yes-i-am-thinking-snuggly-badger.md.
- **Multi-city RoutePlanner UI** (`components/RoutePlanner.tsx`) shipped + wired into the form step (collapsible). [done earlier this session]
- **Bucket 1 — latency:** (1a) `warmGeocodeCache()` in flightTime.ts + costMatrix uses it → killed the O(n²) per-pair 1.1s geocode stagger (route-order: ~17s→~4s cold for 6 cities, **0.008s warm**); rate-limit gate moved inside `geocodeCity` so cache hits never wait. (1b) suggest geocoding de-serialized via warmGeocodeCache. (1c) **itinerary response cache** (new `lib/ttlCache.ts`, 10min/50-LRU) — live-proven 37.7s→**0.0038s** on identical re-request. (1d) airport-code LLM cache (7.1s→0.003s). (1e) prices/trains/hotels caches now bounded (were unbounded Maps) via shared ttlCache.
- **Bucket 2 — tokens:** (2a) itinerary example JSON trimmed to type-skeleton (~200-300 tok/call). (2b) constraint re-prompt now diff-style (prior JSON + violations, not full prompt+context — ~50% input cut). (2c) attraction context scales with trip length (`min(20, tripDays*5)`). (2d) suggest budget 4096→2048. (2e) destination schema example deduped to one `DESTINATION_SCHEMA_EXAMPLE` const (was in 3 places).
- **Bucket 3 — dedup:** (3a) merged agnes.ts+openrouter.ts into shared `lib/openaiCompatProvider.ts` (engine + SSE parse + token descent + 429 backoff); both now ~50-line config wrappers (openrouter 351→~85 lines). (3b) 3 TTL-blacklist caches → one `lib/healthCache.ts`. (3c) gemini.ts + localModel.ts routed through the shared engine → **brought to parity** (gained per-model health cache + 429 backoff; previously threw immediately). (3d) removed the duplicated "extended coverage" IATA block in amadeus.ts (pure dup of cityToAirport fallback — verified). (3e) DEVIATION: kept pathCost/checkReachability/hasCoordinates exported + defaultFlightHours inline (test-covered utilities; de-exporting would delete working coverage for no real gain).
- New tests: `ttlCache.test.ts` (4), `healthCache.test.ts` (6), `openaiCompatProvider.test.ts` (9).
- Untouched by choice: 4 pre-existing `app/page.tsx` `any` eslint errors (confirmed unchanged); 1f train-fetch Promise.any (deferred — not hot path).

## Completed 2026-06-21
- 4 cleanup items: geocode→SQLite L1/L2 cache, `defaultFlightHours`→`estimateFlightHours`, `init_db.py` `schema_version` table, `choose-ai-provider.js` blank/comment/quote-safe
- FlyAI (#5) reclassified blocked (obfuscated Fliggy MCP client needing creds, not a CLI shim)
- Investigated 15 external repos → consolidated `IMPLEMENTATION_PLAN.md` (4 borrows, leverage-ordered)
- **Implemented Item 1: itinerary constraint validator** (`lib/itineraryConstraints.ts`) + route wiring + caveats badge + 18 tests. tsc + `next build` clean, 79/79 tests pass
- **Implemented Items 2, 3, 4(A+B+API):** fast-flights pin (`requirements.txt`), Duffel provider (`lib/duffel.ts`), route-ordering engine (`lib/routeOrder.ts` + `lib/costMatrix.ts` + `/api/route-order`, live-tested)
- **Added Agnes AI as primary LLM** (`lib/agnes.ts`, OpenAI-compatible) replacing OpenRouter as default; chain agnes→openrouter→gemini→local
- **✅ LIVE e2e validation PASSED via Agnes** — suggest + itinerary (constraint validator finalPass=true) + chat streaming all green. Caught & fixed 4 bugs (removed noisy `wrong_city` rule, relaxed `day_count` nights-vs-days, `AI_PROVIDER` comma-list parsing, itinerary token budget 4096→8192). 104/104 tests, tsc + build clean
- Docs updated (README + Vercel deploy refs, IMPROVEMENTS, SESSION_LOG, .gitignore WAL files)

## Completed 2026-05-24
- Git repository initialized (main branch, 5 commits)
- Vitest test suite (61 tests, 7 files)
- CI workflow updated with test step
- Preference matching filter (scores, deprioritises, re-prompts for replacements)
- Geocoding sanity check (country-region minimum flight hours)
- Parallelised Nominatim geocoding
- Prompt strengthening (HARD RULES for disliked activities)
- Response caching (10min TTL, 50 entries)
- Temperature tuning (0.2 for JSON correction)
- Prompt token optimisation (skip irrelevant flight references)
- IATA map merge (amadeus.ts + airports.ts fallback)
- hafas profile fallback (DB → OeBB → SNCB)
- UI loading states for train/hotel estimates
- ErrorBoundary for destination card grid
- Hostel estimate replaced with static regional data (+20 cities)
- Preference warning badge on deprioritised cards
- External repo investigation (10 repos assessed, findings in git-repo-investigation.md)
- Installed fast-flights (Google Flights scraper) and flyai-cli (Fliggy)
- Set up .env.local with OpenRouter key + multiple free model fallbacks
- Attempted end-to-end test (pipeline works but free models rate-limited)

## Completed previous sessions
- Kiwi.com Tequila API integration (flight prices)
- Independent flight time validation (great-circle + Nominatim)
- Re-prompt when all destinations filtered by travel time
- hafas-client live European train prices
- Amadeus Hotel Search live hotel prices
- Batched train/hotel fetches at parent level
- Scraper rewrite: retry, JSON validation, normalization
- Wikipedia Pageviews API (trending signals)
- yt-dlp video search (YouTube extraction)

## Pending / Blocked

### Feature backlog from repo investigation (2026-06-21)
See `IMPLEMENTATION_PLAN.md` for the full plan. 4 borrows, leverage-ordered:
1. ✅ **Itinerary constraint validator** (`lib/itineraryConstraints.ts`) — DONE 2026-06-21. Deterministic hard/commonsense checks (day-count, budget best-effort, transport-mode, empty-day, dup-venue, wrong-city, within-sandbox); wired into `itinerary/route.ts` via `respondWithItinerary` with a guarded single re-prompt on hard violations (falls back to original, never blocks); `constraintReport` returned in response + amber caveats badge in `app/page.tsx`. 18 unit tests, tsc + `next build` clean. Re-prompt loop unverified live (blocked on OpenRouter key) but fail-safe.
2. ✅ **fast-flights hardening** — DONE 2026-06-21. Diagnosed: `google_flights.py` uses the 2.x API (`get_flights(flight_data=[FlightData(...)], ...)`); v3.0 (`create_query`/`FlightQuery`) would break it. Last 2.x = 2.2 (verified against the v2.2 tag README). Created `requirements.txt` pinning `fast-flights==2.2`; Dockerfile + README now install via `-r requirements.txt`; added breaking-change + maintainer-status notes in requirements.txt, google_flights.py header, and README. Best-effort fallback going forward; Duffel (#3) is the durable fix.
3. ✅ **Duffel flight provider** (`lib/duffel.ts`) — DONE 2026-06-21. Official flight API, mirrors the kiwi.ts contract (`searchFlights`/`isConfigured`). Inserted as the FIRST provider in `prices/route.ts` fallback chain (Duffel → Kiwi → fast-flights), env-gated on `DUFFEL_API_TOKEN` (no-op when unset). API verified against official docs (POST /air/offer_requests?return_offers=true, Duffel-Version v2, slices/passengers/cabin_class; offer total_amount/owner.name/slices→segments). 8 unit tests (fetch-mocked), tsc + `next build` clean, 87/87 pass. Env added to `.env.local.example` + README.
4. 🟡 **Multi-city route ordering** — Phase A + B DONE 2026-06-21; Phase C (UI/flow) PENDING user go-ahead.
   - ✅ **Phase A** `lib/routeOrder.ts` — pure open-path TSP: Held-Karp exact (n≤10) + nearest-neighbor/2-opt (n>10); asymmetric matrices, Infinity = unavailable leg, fixedStart/fixedEnd anchors. 11 tests incl. brute-force optimality checks.
   - ✅ **Phase B** `lib/costMatrix.ts` — `buildCostMatrix(cities, {unavailable, unknownLegCost})` → asymmetric matrix seeded from great-circle flight hours; unavailable legs → Infinity; unresolved → finite fallback. 5 tests.
   - ✅ **Phase C — API route only** (DONE 2026-06-21, UI deferred by choice). `app/api/route-order/route.ts`: POST `{cities, homeCity?, endCity?, unavailable?}` → `{order, segments, totalHours, unresolved}`. Dedupes cities, anchors start/end, 422 when no valid route. **Live-tested** against `next start`: London/Paris/Madrid/Rome ordered sensibly (5.2h); blocking London→Paris correctly forced the Rome detour; 1-city → 400.
   - ✅ **Phase C — UI** DONE 2026-06-24. `components/RoutePlanner.tsx`: standalone multi-city optimizer (add/remove city chips, optional start/end anchor selects) calling `/api/route-order`, rendering ordered route + per-leg segments + total hours + unresolved-fallback warnings. Surfaced as a collapsible tool below `TripPlannerForm` on the form step (`app/page.tsx`, `showRoutePlanner` toggle). Deliberately NOT threaded through `TripPlannerInput`/the suggest→itinerary state machine — the endpoint stands alone, so a standalone tool is the surgical choice. tsc clean, `next build` clean, 104/104 tests pass. Live-tested via `next start`: London/Paris/Madrid/Rome → Rome/Madrid/Paris/London 5.2h, start-anchor honored, 1-city → 400, page 200 + toggle present in HTML. (Pre-existing 4 `any` eslint errors in page.tsx left untouched.)

### LIVE validation DONE 2026-06-21 (via Agnes)
- ✅ **End-to-end test** of full flow — suggest ✓, itinerary ✓ (constraintReport finalPass=true), chat streaming ✓
- ✅ **Preference matching** validated — correctly matches with real UI category labels (0 false deprioritisations). NOTE: only matches exact category labels, not raw terms (brittle but works via UI)
- ✅ **Constraint validator + re-prompt** validated — caught a real day_count miss; re-prompt fires & is fail-safe. Caught + fixed 2 validator false-positive bugs (removed noisy `wrong_city`, relaxed `day_count` for nights-vs-days)
- ✅ **Fixed** `AI_PROVIDER` comma-list parsing + itinerary token-budget truncation (raised to 8192)

### Still to validate
- ✅ **Geocoding sanity check** — DONE 2026-06-26. Added 5 tests to `flightTime.test.ts` pinning the guard's real decision boundary (the `claimedHours < minHours * 0.7` trigger — both sides), the reverse-direction region-pair fallback (Europe↔Africa), the headline obscure-city case (dest region derived from the *country*, so an obscure dest city like Kanazawa is still caught via "Japan"), and the one documented blind spot (no region-pair in either direction, e.g. South-Asia↔Africa Delhi→Kenya → uncorrectable, acceptable). 128/128 suite green, tsc clean.
- **Duffel** (#3) — still needs first live call once `DUFFEL_API_TOKEN` is set (user obtaining)
- **Nova** — wired + tsc-clean but no live call yet. Set a real `NOVA_API_KEY` in `.env.local`, then run one `generate` through the chain (Agnes wins when both set, so test Nova directly via `AI_PROVIDER=nova` or by unsetting `AGNES_API_KEY`). Hitting `api.nova.amazon.com` needs `dangerouslyDisableSandbox` + user OK.

### Deliberately parked 2026-06-26 (user decision — skip both)
- **Streaming token-loop trim** — stream `tokenCandidates=[2048,512,128]` in `openaiCompatProvider.ts` backs the interactive travel chat, where longer replies ARE the feature (the JSON `generate` path was already trimmed). Trimming risks truncating chat answers for marginal token savings. Not an obvious win; skipped pending a concrete target.
- **Multi-instance cache durability** — TTL/health caches are in-process Maps; geocode L2 is already SQLite. Sharing the rest across instances is real infra that only pays off under a multi-instance deploy that doesn't exist yet. Premature; skipped.

### Blocked on third-party
- Kiwi.com Tequila API — self-service signup appears discontinued
- Amadeus Hotel Search — self-service signup appears discontinued
- hafas-client network verification in deployed environment
- **FlyAI / Fliggy (China inventory)** — `@fly-ai/flyai-cli` v1.0.16 is NOT a stdout-JSON CLI like google_flights.py; it's a streamable-HTTP MCP client for Alibaba/Fliggy requiring `FLYAI_SIGN_SECRET` that must match the Fliggy MCP server (HMAC + AES-256-GCM). Also ships device-fingerprint headers (`x-ff-ctx`) and is published as an obfuscated bundle. Not installed here (despite earlier session note). Blocked on Fliggy MCP credentials; integrating the obfuscated fingerprinting bundle needs explicit sign-off. (2026-06-21 investigation)

## Remaining improvements (prioritised)
1. ✅ **Persist geocode results to SQLite** — `geocode_cache` table in init_db.py; flightTime.ts geocodeCity uses L1 Map + L2 SQLite (getCachedGeocode/saveGeocode in db.ts). Transient network errors not cached.
2. ✅ **`defaultFlightHours()` heuristic cleanup** — replaced ~30-line regex heuristic with `estimateFlightHours()` great-circle calc (fallback 6h). Note: the real replacement is estimateFlightHours, not sanityCheckFlightHours (the latter corrects a claim, can't produce a default).
3. ✅ **`init_db.py` migration tracking** — `schema_version` table + SCHEMA_VERSION constant, idempotent insert. Verified create + re-run.
4. ✅ **`choose-ai-provider.js`** — now preserves blank lines/comments, matches quoted + `export` + whitespace-prefixed AI_PROVIDER assignments. Verified across 4 cases.
5. ⛔ **Integrate FlyAI for China-centric inventory** — RECLASSIFIED as blocked-on-third-party (see above). Not the CLI shim the original estimate assumed; needs Fliggy MCP credentials + sign-off on an obfuscated fingerprinting bundle.

## Future enhancements (from repo investigation)
### High priority (post-testing)
- SSE progress streaming for suggest endpoint (from tripper pattern)
- Amadeus flight search as Kiwi alternative (if API access restored)
- Spatio-temporal itinerary validation (from TripCraft)
- Composable constraint pipeline (from ChinaTravel LLM-Modulo pattern)

### Medium priority
- Itinerary email/PDF export (from ai-travel-agent)
- Multi-source price comparison: Skiplagged, Airbnb (from travel-hacking-toolkit)
- Airport search API to replace static IATA map (from travel-mcp-server)
- Human-in-the-loop for itinerary approval

### Lower priority
- Dark mode
- Interactive map (Leaflet + route array)
- Flexible date price heatmap
- Weather forecasts (Open-Meteo)
- Destination photos (Unsplash API)
- User accounts + saved trips
- PWA / offline itinerary
- Packing list generator
