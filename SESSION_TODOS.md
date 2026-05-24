# Session To-Dos
> Last updated: 2026-05-24

## Completed this session
- Git repository initialized (main branch)
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
- End-to-end test of Kiwi API — requires KIWI_API_KEY in .env.local
- End-to-end test of Amadeus API — requires AMADEUS_CLIENT_ID + SECRET
- End-to-end test of scraper — requires OPENROUTER_API_KEY
- Manual test of preference matching with live AI — requires OPENROUTER_API_KEY
- hafas-client network verification in deployed environment

## Remaining improvements (prioritised)
1. **Persist geocode results to SQLite** — cache successful Nominatim lookups in attractions.db so coverage grows over server restarts. Small effort.
2. **`defaultFlightHours()` heuristic cleanup** — now largely superseded by sanityCheckFlightHours. Remove or simplify the dead-code fallback. Low effort.
3. **`init_db.py` migration tracking** — uses try/except for ALTER TABLE. Add schema_version table. Low effort.
4. **`choose-ai-provider.js`** — strips blank lines from .env.local, no quoted value support. Low effort.

## Future enhancements
- Dark mode
- Interactive map (Leaflet + route array)
- Flexible date price heatmap
- Weather forecasts (Open-Meteo)
- Destination photos (Unsplash API)
- User accounts + saved trips
- PWA / offline itinerary
- Itinerary editing via chat
- Packing list generator
- Booking.com Affiliate API for live hostel prices
- Suspense/route segments for loading states
