# Session To-Dos
> Last updated: 2026-05-23

## Completed this session
- Kiwi.com Tequila API integration (flight prices primary provider)
- Independent flight time validation (great-circle + Nominatim geocoding)
- Re-prompt when all destinations filtered out by travel time constraint
- hafas-client live European train prices
- Amadeus Hotel Search live hotel prices
- Batched train/hotel fetches at parent level (12 → 2 requests)
- Scraper rewrite: retry, JSON validation, normalization, POST for Overpass, single DB connection
- Kiwi flex-date support (searches ± flexDays for cheaper flights)
- Amadeus hotel ID cache (halves quota)
- hafas station ID pre-mapping (30 cities)
- Flight time coordinate table expanded (~35 new cities)
- IMPROVEMENTS.md tracking document

## Pending / Blocked
- End-to-end test of Kiwi API — requires KIWI_API_KEY in .env.local
- End-to-end test of Amadeus API — requires AMADEUS_CLIENT_ID + SECRET in .env.local
- End-to-end test of scraper with live API key — blocked on OPENROUTER_API_KEY
- hafas-client needs network access to DB backend — verify in deployed environment

## Remaining improvements (prioritised)
1. ~~**Trending signals broken**~~ — Replaced TikTok/Instagram with Wikipedia Pageviews API (reliable, free, absolute view counts that fit existing thresholds).
2. ~~**YouTube video ID extraction fragile**~~ — Replaced HTML regex scraping with yt-dlp `ytsearch:` (uses yt-dlp's built-in search, no HTML parsing).
3. **hafas only uses DB profile** — UK (National Rail) and Spain (Renfe) routes may not return results. Add SNCF/OEBB profiles.
4. **Hostel estimate is synthetic** — Amadeus doesn't list hostels; `cheapest * 0.4` is a rough guess. Keep static hostel values or add Hostelworld.
5. **`cityToIataCode()` in amadeus.ts** — only ~45 cities. Merge with airports.ts IATA map for wider coverage.
6. **`defaultFlightHours()` heuristic** — still present as last-resort in suggest route; rarely hit now but could be removed.
7. **`init_db.py` migration tracking** — uses try/except for ALTER TABLE. Add schema_version table.
8. **`choose-ai-provider.js`** — strips blank lines from .env.local, no quoted value support.

## Future enhancements (from README)
- Loading states / Suspense — split app into route segments
- Dark mode — implement or remove CSS variables
- Interactive map (Leaflet + route array)
- Flexible date price heatmap
- Weather forecasts (Open-Meteo)
- Destination photos (Unsplash API)
- User accounts + saved trips
- PWA / offline itinerary
- Itinerary editing via chat
- Packing list generator
