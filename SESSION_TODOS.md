# Session To-Dos
> Last updated: 2026-05-24 (end of session)

## Completed this session
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

### Immediate (next session)
- **Add OpenRouter paid credits** ($5 on https://openrouter.ai/settings/billing)
- **Update .env.local** to use `deepseek/deepseek-chat` as primary model (~$0.001/req)
- **End-to-end test** of full flow: suggest → preference filter → pricing → itinerary
- **Validate preference matching** with live AI output (does it correctly deprioritise mismatches?)
- **Validate geocoding sanity check** (does it catch hallucinated flight times for obscure cities?)

### Blocked on third-party
- Kiwi.com Tequila API — self-service signup appears discontinued
- Amadeus Hotel Search — self-service signup appears discontinued
- hafas-client network verification in deployed environment

## Remaining improvements (prioritised)
1. **Persist geocode results to SQLite** — cache Nominatim lookups in attractions.db. Small effort.
2. **`defaultFlightHours()` heuristic cleanup** — superseded by sanityCheckFlightHours. Low effort.
3. **`init_db.py` migration tracking** — add schema_version table. Low effort.
4. **`choose-ai-provider.js`** — strips blank lines, no quoted value support. Low effort.
5. **Integrate FlyAI for China-centric inventory** — already installed, needs route integration. Medium effort.

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
