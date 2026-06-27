# ✈️ Travel Planner AI

[![CI](https://github.com/ysl1215/travel-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/ysl1215/travel-planner/actions/workflows/ci.yml)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fysl1215%2Ftravel-planner&env=AGNES_API_KEY&envDescription=Agnes%20AI%20key%20(default%20LLM)%20-%20see%20agnes-ai.com%2Fdoc&envLink=https%3A%2F%2Fagnes-ai.com%2Fdoc%2Foverview&project-name=travel-planner-ai&repository-name=travel-planner-ai)

An AI-powered travel planner that creates personalized destination suggestions and detailed day-by-day itineraries based on your budget, dates, travel preferences, and style. Designed for budget-conscious, off-the-beaten-path travelers.

---

## 🚀 Deploy in 2 minutes (Vercel — free)

> **Why not GitHub Pages?** GitHub Pages is static-only — it can't run the server-side Next.js API routes that power the AI features. Vercel is the right home for full-stack Next.js apps and has a free tier.

### Option 1 — One-click deploy (fastest)

Click **"Deploy with Vercel"** above, enter your `AGNES_API_KEY` ([Agnes AI docs →](https://agnes-ai.com/doc/overview)) — the default LLM provider — and deploy. (Any one AI provider key works; see the env table.)

### Option 2 — Self-host (required for flight prices + attraction scraping)

Vercel serverless functions can't spawn Python subprocesses. For the full experience:

```bash
# Railway / Render / Fly.io (all have free tiers)
# Build command:  npm install && pip install -r requirements.txt && npm run build
# Start command:  npm run start
# Env var:        AGNES_API_KEY  (default LLM; or any one of NOVA_API_KEY / OPENROUTER_API_KEY / GEMINI_API_KEY)
```

---

## 🏠 Run locally

```bash
git clone https://github.com/ysl1215/travel-planner.git
cd travel-planner
npm install

# Copy and fill in your API key
cp .env.local.example .env.local

# Python dependencies (for live flight prices)
# fast-flights is pinned to 2.2 — 3.x is a breaking API change (see requirements.txt)
pip install -r requirements.txt

# Initialise the attraction index database (one-time)
python3 scripts/init_db.py

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## ▶️ Try the demo (no API key needed)

Click **"Try Demo"** on the landing page to load a pre-built sample trip (London → Lisbon, $4,000 USD, 7 days).

---

## ✨ Features

### 1. Smart Trip Planning Form
- Budget + currency (USD, EUR, GBP, SGD, AUD, CAD, JPY)
- Home city → auto-mapped to IATA airport code (static map + AI fallback for unlisted cities)
- Dates with flexibility slider (±0–14 days)
- Activity preferences (liked + de-prioritised)
- Travel mode, travel style
- Max travel time from home (hard constraint)
- **Off-the-beaten-path toggle** — when on, AI prioritises hidden gems and lesser-known destinations over tourist hotspots

### 2. AI Destination Suggestions
- 4–6 destinations tailored to budget, preferences, and home city
- AI returns IATA airport codes for each destination
- Budget fit (Excellent / Good / Stretch) — recalculated with real flight prices × travelers (marked ✓)
- Destinations re-ranked by cheapest total flight cost after price comparison
- Hard travel time constraint enforced in prompt + server-side filter (20% buffer)
- Suggested cities automatically queued for attraction scraping

### 3. Live Flight Prices
- Per-card "Check live prices" button + "Compare All Flight Prices" batch fetch
- **Primary:** [Duffel](https://duffel.com) — official flight API (NDC + GDS), stable and supported. The durable, recommended source.
- **Secondary:** [Kiwi.com Tequila API](https://tequila.kiwi.com) — 100 free searches/month, reliable structured data
- **Fallback:** Google Flights scraping via [fast-flights](https://github.com/AWeirdDev/flights) — no API key, unlimited but less reliable. Pinned to `2.2` (3.x is a breaking API change; upstream maintainer has stepped back — treat as best-effort).
- Provider chain: Duffel → Kiwi → fast-flights; each falls through on empty/error
- Budget fit recalculated from `cheapestPrice × travelers` (not per-ticket)
- 20-minute in-memory cache, 3-concurrent batch limit
- Retry with exponential backoff on transient failures

### 4. Transport & Accommodation Estimates
- **Train fares** — live European prices via [hafas-client](https://github.com/public-transport/hafas-client) (DB/ÖBB/SBB/SNCF/NS backends, no API key). Falls back to static city-pair estimates (60+ cities, 40+ routes).
- **Accommodation** — live hotel prices via [Amadeus Hotel Search API](https://developers.amadeus.com) (2,000 calls/month free). Falls back to static hostel/budget/mid-range estimates for 70+ cities.
- **Budget slider pre-set** — after real flight prices arrive, travel slice is anchored to cheapest total flight cost; accommodation slice anchored to real/estimated nightly rate for cheapest destination.

### 5. Budget Allocation Slider
- Interactive split: Travel, Accommodation, Food, Activities, Misc
- Live pie chart (lazy-loaded via `next/dynamic`)
- Pre-set from real prices after "Compare All" completes

### 6. Day-by-Day Itinerary
- Morning / afternoon / evening schedule
- **Cluster cards** — when 2+ attractions share a geographic area (e.g. multiple lakes, trails), surfaces half-day vs full-day options with honest tradeoffs. User selects; AI recommends.
- Mix of tourist attractions + hidden gems
- Food recommendations (tourist-trap flagged)
- Optimal routing with transit tips
- Costs flagged as AI estimates throughout
- Four tabs: Itinerary · Attractions · Food · Practical Tips
- First 3 days shown initially; "Show all N days" expands
- **Constraint validation** — after generation, a deterministic (non-LLM) validator checks the whole plan against hard constraints (day count vs date span, best-effort budget, allowed transport modes) and commonsense rules (no empty days, no duplicate venues, right-city activities, no hallucinated attractions vs the index). Hard violations trigger one fail-safe corrective re-prompt; remaining caveats surface as an amber badge above the itinerary (`lib/itineraryConstraints.ts`)

### 7. Attraction Index (pre-built, offline)
- SQLite database (`data/attractions.db`) populated by offline scraper
- Sources: Wikivoyage (primary) + YouTube transcripts (supplementary)
- Trending signal from Wikipedia pageviews (3-month total, free API)
- When a city is indexed, real durations, difficulty, tips, and nearby attractions are injected into the itinerary prompt
- Itinerary header shows "Enhanced with N local attractions" badge when indexed
- Cities auto-queued when suggested; check status at `/api/scrape-status`

### 8. AI Chat Assistant
- Floating chat, context-aware of current destination and trip
- Sliding window of last 10 messages to control token usage
- Streaming responses via multi-provider AI

### 9. Multi-Provider AI with Automatic Fallback
- Agnes AI → Nova → OpenRouter → Gemini → Local model fallback chain (Agnes is the default primary; OpenAI-compatible)
- Provider health tracking with configurable TTLs (shared `lib/healthCache.ts`)
- Token candidate loop: `[4096, 1024, 256]` (reduced from 11 candidates)
- Rate limiting: 10 req/min on suggest/itinerary, 20 req/min on chat (per IP)
- Agnes + Nova + OpenRouter share one OpenAI-compatible engine (`lib/openaiCompatProvider.ts`); Gemini + Local route through the same model-loop, so all five get per-model health tracking + 429 backoff
- Optional token/cost metering to a shared Postgres `token_usage` table (`lib/llmBudget.ts` + `lib/tokenUsageDb.ts`), tagged by operation (`taskType`). Meters non-streamed calls (suggest/itinerary/etc.); the chat stream is not metered yet. No-op unless `DATABASE_URL` is set. Agnes is internal/$0; other providers are priced.

### 10. Multi-City Route Optimizer
- Standalone tool (collapsible on the planning form): enter a known set of cities and get the shortest visiting order
- Engine: open-path TSP (`lib/routeOrder.ts`, exact Held-Karp ≤10 cities, nearest-neighbor + 2-opt above) over a great-circle cost matrix (`lib/costMatrix.ts`); optional start/end anchors, routes around unavailable legs
- Geocoding is warmed once per unique city (`warmGeocodeCache`), so a cold multi-city request scales with the city count, not the number of city pairs

---

## 🗂️ Attraction Index — Setup & Usage

The attraction index enriches itineraries with real duration data, local tips, and difficulty ratings scraped from Wikivoyage and YouTube.

### First-time setup

```bash
# 1. Initialise the database (creates data/attractions.db)
python3 scripts/init_db.py

# 2. Use the app normally — suggested cities are auto-queued for scraping

# 3. Check what's queued
curl http://localhost:3000/api/scrape-status

# 4. Run the scraper (needs OPENROUTER_API_KEY or GEMINI_API_KEY)
python3 scripts/scrape_attractions.py

# 5. Check again when done
curl http://localhost:3000/api/scrape-status
```

### Scrape a specific city immediately

```bash
python3 scripts/scrape_attractions.py --city "Lisbon" --country "Portugal"

# Dry-run (print extracted JSON without writing to DB)
python3 scripts/scrape_attractions.py --city "Lisbon" --dry-run
```

### What the scraper does per city

1. Fetches Wikivoyage page via public API (no scraping, CC-licensed)
2. LLM extracts structured attraction data (name, type, duration, difficulty, tips, confidence)
3. Searches YouTube for travel videos, fetches transcripts, LLM extracts additional attractions
4. Merges results (no duplicates by name)
5. Fetches Wikipedia pageviews as trending signal (3-month total)
6. Writes everything to SQLite

### Estimated time per city
- Wikivoyage + LLM: 2–5 min
- YouTube transcripts: 3–8 min
- Trending signals: 1–2 min
- **Total: ~5–15 min per city**

---

## ⚙️ Environment Variables

| Variable | Required | Description |
|---|---|---|
| `AGNES_API_KEY` | **Yes**¹ | Agnes AI key — default primary provider ([docs](https://agnes-ai.com/doc/overview)). OpenAI-compatible. |
| `AGNES_MODEL` | No | Override Agnes model (default: `agnes-2.0-flash`) |
| `AGNES_MODELS` | No | Comma-separated Agnes model fallback list |
| `AGNES_BASE_URL` | No | Override base URL (default: `https://apihub.agnes-ai.com/v1`) |
| `NOVA_API_KEY` | No¹ | Amazon Nova key — OpenAI-compatible Bearer gateway, first fallback after Agnes |
| `NOVA_MODEL` | No | Override Nova model (default: `nova-pro-v1`; also `nova-premier-v1`/`nova-lite-v1`/`nova-micro-v1`/`nova-2-lite-v1`) |
| `NOVA_MODELS` | No | Comma-separated Nova model fallback list |
| `NOVA_BASE_URL` | No | Override base URL (default: `https://api.nova.amazon.com/v1`) |
| `OPENROUTER_API_KEY` | No¹ | Free key from [openrouter.ai/keys](https://openrouter.ai/keys) — fallback provider |
| `OPENROUTER_MODEL` | No | Override model (default: `meta-llama/llama-3.3-70b-instruct:free`) |
| `OPENROUTER_MODELS` | No | Comma-separated model fallback list |
| `AI_PROVIDER` | No | Primary provider: `agnes` (default), `nova`, `openrouter`, `gemini`, `local` |
| `AI_PROVIDER_ORDER` | No | Fallback order (default: `agnes,nova,openrouter,gemini,local`) |
| `GEMINI_API_KEY` | No | Google Gemini API key |
| `LOCAL_MODEL_URL` | No | Local model server URL (default: `http://localhost:8000/generate`) |
| `DUFFEL_API_TOKEN` | No | Duffel official flight API token ([signup](https://duffel.com)). Durable primary flight source; tried before Kiwi. |
| `KIWI_API_KEY` | No | Kiwi.com Tequila API key for flight prices ([free signup](https://tequila.kiwi.com)). Tried after Duffel, before `fast-flights`. |
| `AMADEUS_CLIENT_ID` | No | Amadeus API client ID for live hotel prices ([free signup](https://developers.amadeus.com)). Falls back to static estimates. |
| `AMADEUS_CLIENT_SECRET` | No | Amadeus API client secret |
| `AMADEUS_ENV` | No | `test` (default, 2,000/month free) or `production` |
| `DATABASE_URL` | No | Postgres connection string (shared Supabase pooled string) for LLM token metering. Unset = metering is a silent no-op. |

¹ At least one AI provider key is required. Agnes is the default primary; if its key is absent the chain falls through to OpenRouter → Gemini → Local, so any single one works.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| AI | Agnes AI (primary) / Nova / OpenRouter / Gemini / Local — multi-provider fallback |
| Flight prices | [Duffel](https://duffel.com) (primary) → [Kiwi.com Tequila API](https://tequila.kiwi.com) → [fast-flights](https://github.com/AWeirdDev/flights) fallback |
| Train prices | [hafas-client](https://github.com/public-transport/hafas-client) (live European rail) + static fallback |
| Hotel prices | [Amadeus Hotel Search](https://developers.amadeus.com) (live) + static fallback |
| Attraction index | SQLite (`better-sqlite3`) + Python scraper |
| Charts | Recharts (lazy-loaded) |
| Icons | Lucide React |
| Validation | Ajv (JSON Schema) |
| Deployment | Vercel (AI only) / Railway / Render (full stack) |

---

## 📁 Project Structure

```
travel-planner/
├── app/
│   ├── page.tsx                    # Main app (form → destinations → itinerary)
│   └── api/
│       ├── suggest/route.ts        # AI destination suggestions + auto-queue cities
│       ├── itinerary/route.ts      # AI itinerary generation + index injection + constraint validation
│       ├── chat/route.ts           # Streaming AI chat (sliding window)
│       ├── prices/route.ts         # Flight prices: Duffel → Kiwi → fast-flights (bounded cache)
│       ├── route-order/route.ts    # Multi-city route optimizer (open-path TSP)
│       ├── airport/route.ts        # City → IATA code (static + cached AI fallback)
│       ├── scrape-status/route.ts  # Scrape queue status
│       └── demo/route.ts           # Pre-seeded mock data
├── components/
│   ├── TripPlannerForm.tsx         # Step 1: preferences form (incl. hidden gems toggle)
│   ├── RoutePlanner.tsx            # Multi-city route optimizer UI (collapsible on form step)
│   ├── DestinationCard.tsx         # Card with flight prices, train + accom estimates
│   ├── BudgetSlider.tsx            # Budget allocation with lazy-loaded pie chart
│   ├── BudgetPieChart.tsx          # Recharts pie (dynamically imported)
│   ├── ItineraryView.tsx           # Itinerary tabs with cluster cards
│   ├── ClusterCard.tsx             # Half-day / full-day option selector
│   ├── ErrorBoundary.tsx           # Destination grid error boundary
│   └── ChatAgent.tsx               # Floating AI chat
├── lib/
│   ├── ai.ts                       # Multi-provider AI abstraction (provider-level health cache)
│   ├── openaiCompatProvider.ts     # Shared OpenAI-compatible engine (model loop, token descent, 429 backoff, SSE)
│   ├── agnes.ts                    # Agnes client (thin config wrapper over the shared engine)
│   ├── nova.ts                     # Amazon Nova client (thin config wrapper over the shared engine)
│   ├── openrouter.ts               # OpenRouter client (thin config wrapper; richer error inspection)
│   ├── gemini.ts                   # Gemini client (native shape, routed through the shared model-loop)
│   ├── localModel.ts               # Local model client (native shape, routed through the shared model-loop)
│   ├── healthCache.ts              # Shared TTL failure-blacklist (per-provider + per-model)
│   ├── llmBudget.ts                # Token-metering pure logic (rates, normalize usage, cost, never-throws logUsage)
│   ├── tokenUsageDb.ts             # Server-only pg writer to the shared token_usage table (no-op without DATABASE_URL)
│   ├── ttlCache.ts                 # Shared bounded TTL response cache (suggest/itinerary/prices/trains/hotels)
│   ├── aiFix.ts                    # JSON correction (schema hints, preferShortFirst)
│   ├── airports.ts                 # City → IATA static map
│   ├── amadeus.ts                  # Amadeus hotel search + metro IATA codes
│   ├── duffel.ts                   # Duffel official flight API provider
│   ├── kiwi.ts                     # Kiwi.com Tequila flight provider
│   ├── flightTime.ts               # Great-circle flight hours + Nominatim geocode (L1/L2 cache, warmGeocodeCache)
│   ├── routeOrder.ts               # Open-path TSP (Held-Karp + nearest-neighbor/2-opt)
│   ├── costMatrix.ts               # Asymmetric great-circle cost matrix for route ordering
│   ├── prompts.ts                  # Prompt builders (destination, itinerary, chat) + shared schema example
│   ├── types.ts                    # TypeScript types (incl. ItineraryCluster, RouteSegment)
│   ├── db.ts                       # SQLite access layer (better-sqlite3; geocode_cache)
│   ├── attractionContext.ts        # Formats DB attractions for prompt injection (trip-length-scaled)
│   ├── itineraryConstraints.ts     # Deterministic post-gen constraint validator (hard + commonsense)
│   ├── preferenceMatch.ts          # Scores/sorts destinations against user preferences
│   ├── rateLimit.ts                # Sliding-window in-memory rate limiter
│   ├── hafas.ts                    # Live European train search (hafas-client)
│   ├── trainFares.ts               # Static European train fare estimates
│   ├── accomEstimates.ts           # Static accommodation cost estimates (70+ cities)
│   └── schemas/
│       ├── destinations.schema.json
│       └── itinerary.schema.json   # Includes clusters array schema
├── data/
│   └── attractions.db              # SQLite attraction index (gitignored)
├── scripts/
│   ├── init_db.py                  # Create/migrate attractions.db (geocode_cache + schema_version)
│   ├── scrape_attractions.py       # Wikivoyage + YouTube + trending → SQLite
│   ├── google_flights.py           # fast-flights (Google Flights) price scraper, pinned 2.2
│   └── choose-ai-provider.js       # Switch AI provider
├── requirements.txt                # Python deps (fast-flights==2.2 pinned)
└── Dockerfile                      # Node 20 + Python 3.11, single-stage
```

---

## 🐛 Known Issues & To-Dos

### P1 — Remaining performance

- [x] ~~**Duplicated provider code / inconsistent fallback**~~ (done 2026-06-24) — Agnes + OpenRouter merged into one shared engine (`lib/openaiCompatProvider.ts`); Gemini + Local brought to parity (per-model health cache + 429 backoff). 3 TTL-blacklist caches → one `lib/healthCache.ts`.
- [x] ~~**Multi-city geocoding O(n²) latency cliff**~~ (done 2026-06-24) — `warmGeocodeCache` geocodes unique cities once; route-order cold time scales with city count, warm is ~instant.
- [x] ~~**No itinerary response cache (most expensive call)**~~ (done 2026-06-24) — bounded TTL cache (`lib/ttlCache.ts`); identical re-request serves from cache instead of re-running the LLM.
- [ ] **Reduce token candidate loop further** — streaming path still tries up to 3 token budgets × N models. Consider a single attempt with a generous budget for streaming.
- [ ] **`better-sqlite3` native module** — requires compilation on deploy. Add `npm install` post-build step or use `@libsql/client` for edge compatibility.
- [ ] **Multi-instance cache durability** — response caches are per-process Maps; on serverless they don't share across instances. Only `geocode_cache` (SQLite) is cross-instance durable. Consider Redis or extending the SQLite pattern if deployed at scale.
- [ ] **Train fetch fans out to all destinations serially across 3 hafas profiles** — `searchTrains` tries DB→ÖBB→SNCB in series, and the client fires `/api/trains` for non-European destinations too. Pre-filter or `Promise.any` (deferred — gated behind the destinations step, not the hot path).

### P2 — Token & quality

- [x] ~~Prompt injection sanitization~~ (done 2026-05-09)
- [x] ~~Sliding window for itinerary correction loop~~ (done 2026-05-09, cached in aiFix.ts)
- [x] ~~Trending signals broken~~ — Replaced with Wikipedia Pageviews API (done 2026-05-23).

### P3 — Hardening & UX

- [ ] **Loading states / Suspense** — app is a single large client component. Split into route segments with `loading.tsx`.
- [ ] **Dark mode** — CSS variables defined but app uses hardcoded light colors. Implement or remove.
- [x] ~~Scraper resilience~~ (done 2026-05-12: retry, UA rotation, delays)
- [x] ~~YouTube transcript language~~ (done 2026-05-09: yt-dlp multi-language fallback)

### Future enhancements

- [ ] 🗺️ Interactive map — Leaflet + `route[]` array for visual routing
- [ ] 📅 Flexible date price heatmap — cheapest weeks within flexibility window
- [ ] 🌤️ Weather forecasts — Open-Meteo (free, no key)
- [ ] 🌍 Destination photos — Unsplash API (`imageQuery` field on every `Destination`)
- [ ] 🧳 Packing list — AI-generated, context-aware
- [ ] 🔐 User accounts + saved trips
- [ ] 📱 PWA — offline itinerary access
- [ ] 💬 Itinerary editing via chat — AI returns structured diff
- [ ] Phase 4 extension — travel blog scraping as additional attraction source

---

## 📝 Changelog

### Session 2026-06-24 — Multi-city UI + performance & cleanup pass

**Feature**
- Multi-city route optimizer UI (`components/RoutePlanner.tsx`) wired into the form step — the `lib/routeOrder.ts` engine + `/api/route-order` endpoint were already built; this exposes them.

**Performance — latency**
- `warmGeocodeCache()` geocodes unique cities once (rate-limit gate moved inside `geocodeCity`, so cache hits never wait); killed the O(n²) per-pair stagger in `buildCostMatrix`. Route-order: ~17s→~4s cold (6 cities), ~instant warm.
- Itinerary response cache (`lib/ttlCache.ts`, 10min/50-LRU): identical re-request 37.7s→0.004s (live-measured).
- Airport-code AI fallback cached; suggest geocoding de-serialized; prices/trains/hotels caches now bounded (were unbounded Maps).

**Performance — tokens**
- Itinerary example JSON trimmed to a type-skeleton; constraint re-prompt now diff-style (prior JSON + violations, not the full prompt+context); attraction context scales with trip length (`min(20, tripDays*5)`); suggest budget 4096→2048; destination schema example deduped to one constant.

**Cleanup — provider layer**
- Merged `agnes.ts` + `openrouter.ts` into a shared OpenAI-compatible engine (`lib/openaiCompatProvider.ts`); both are now ~50-line config wrappers (openrouter 351→~85 lines).
- 3 hand-rolled TTL failure-blacklists → one `lib/healthCache.ts`.
- `gemini.ts` + `localModel.ts` routed through the shared model-loop — gained per-model health cache + 429 backoff (previously threw immediately).
- Removed the duplicated "extended coverage" IATA block in `amadeus.ts` (pure duplication of the `cityToAirport` fallback).

**Tests:** +19 (`ttlCache` 4, `healthCache` 6, `openaiCompatProvider` 9) → 123 total. tsc clean, `next build` clean, full live smoke via Agnes.

### Session 2026-05-12

**Reliability — Flight prices**
- Kiwi.com Tequila API as primary flight search (100 free searches/month, structured data, reliable)
- `fast-flights` (Google Flights scraper) retained as fallback
- Flex-date support: searches ± N days around target for cheaper flights

**Reliability — Train prices**
- Live European train prices via `hafas-client` (DB/ÖBB/SBB/SNCF/NS backends, no API key)
- 30 pre-mapped station IDs for common cities (faster lookups)
- Falls back to static fare estimates when live search fails

**Reliability — Hotel prices**
- Live hotel prices via Amadeus Hotel Search API (2,000 calls/month free)
- Hotel ID caching (24h TTL) halves quota usage per city
- Falls back to static accommodation estimates

**Accuracy — Flight time validation**
- Independent great-circle flight time calculator (135+ cities)
- Nominatim geocoding fallback for cities not in static table
- AI-claimed flight hours now overridden with real distances before filtering
- Prompt includes calibrated reference flight times with ✓/✗ markers
- Auto re-prompt when all suggestions are filtered out (strict geographic retry)

**Performance — Frontend batching**
- Train + hotel estimates fetched in parallel at parent level (was 12 individual requests, now 2 batch)

**Scraper reliability**
- HTTP retry with exponential backoff (3 attempts)
- Shared JSON parser with field validation and enum normalization
- Unicode-aware name deduplication (accent-insensitive)
- OSM Overpass: POST instead of GET (avoids URL length limits)
- Single DB connection per run, batch trending score updates
- Rate limiting between LLM calls

### Session 2026-04-01

**Bug fixes & P0**
- Fixed `chat/route.ts` calling undefined `streamWithOpenRouter` → now uses `stream()` from `lib/ai.ts`
- Fixed Dockerfile: Node 16→20, Python 3.8→3.11, single-stage with both runtimes
- Removed unused deps: `leaflet`, `react-leaflet`, `framer-motion`, `@radix-ui/*`, `date-fns`, `groq-sdk`, `lib/groq.ts`

**Performance & tokens**
- Lazy-loaded recharts via `next/dynamic` (extracted to `BudgetPieChart.tsx`)
- Token candidates reduced: generate `[4096, 1024, 256]`, stream `[2048, 512, 128]`
- Parallel flight scrapes capped at 3 concurrent
- Invalid JSON truncated to 500 chars in `aiFix.ts`; AJV errors replaced with schema hints
- Chat history sliding window (last 10 messages)
- Itinerary days lazy-loaded (first 3 shown, "Show all" expands)
- Destination + itinerary + chat system prompts significantly trimmed
- Removed redundant `shortPrompt`/`expand` dual-path in itinerary route

**Accuracy improvements**
- `defaultFlightHours()` now uses continent-pair heuristics instead of always returning 4
- `preferHiddenGems` toggle wired into destination + itinerary prompts
- Budget fit now uses `cheapestPrice × travelers` (was per-ticket)
- Budget slider pre-set from real flight + accommodation data after "Compare All"
- AI cost estimates flagged throughout itinerary UI
- Origin airport AI fallback via `/api/airport` for unlisted cities
- Rate limiting: 10 req/min suggest/itinerary, 20 req/min chat
- Exponential backoff on 429 (1s → 2s → 4s)

**New features**
- Static European train fare estimates (`lib/trainFares.ts`) — shown on destination cards
- Static accommodation estimates for 70+ cities (`lib/accomEstimates.ts`) — shown on cards + used in budget pre-set
- **Attraction index pipeline** (Phases 1–4):
  - SQLite DB (`data/attractions.db`) with `attractions` + `scrape_queue` tables
  - `scripts/init_db.py` — one-time DB setup + migrations
  - `scripts/scrape_attractions.py` — Wikivoyage + YouTube transcripts + Wikipedia pageviews trending → SQLite
  - `lib/db.ts` — shared Next.js DB access layer
  - `lib/attractionContext.ts` — relevance-scored context injection into itinerary prompt
  - `/api/scrape-status` — queue status endpoint
  - Auto-queue: cities queued automatically when `/api/suggest` returns destinations
  - Itinerary header badge: "Enhanced with N local attractions" vs "No index yet"
- **Cluster cards** (`components/ClusterCard.tsx`) — half-day / full-day option selector for multi-attraction areas (e.g. lake districts, trail networks)
- `ItineraryCluster` type + schema + prompt instruction

### Session 2026-03-31
- AI returns IATA airport codes with destination suggestions
- In-memory price cache (20-min TTL)
- Parallel flight price lookups with `Promise.allSettled`
- Date validation + past-date rejection in Python scraper
- Provider list synced in `choose-ai-provider.js`
- Double-print bug fixed in Python scraper
- Max travel time enforced as hard constraint
- Geographic bias removed from destination prompt
- Re-ranking by real prices + real budget fit recalculation
- Stops parsing fixed (`parse_stops()`)
- Timeout bumped to 30s
- Price unavailable message with specific reason
