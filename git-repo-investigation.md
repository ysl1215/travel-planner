# External Repository Investigation
> Investigated: 2026-05-24

Research into 10 external travel-related repositories to identify features, patterns, or integrations that could add value to Travel Planner AI.

---

## Tier 1: Directly Actionable

### 10. [travel-mcp-server](https://github.com/lev-corrupted/travel-mcp-server) — VERY HIGH relevance

**What:** Python MCP server bridging Claude to Amadeus + AviationStack APIs. Provides flight search, hotel search, live flight tracking, and airport intelligence via Model Context Protocol.

**Tech:** Python 3.10+, MCP v1.20.0, Amadeus Self-Service API, AviationStack API, MIT license.

**Findings:**
- Flight search with pricing/airlines/schedules via Amadeus (we only use Amadeus for hotels currently)
- Flexible date discovery for budget travelers
- Real-time flight tracking (location, altitude, ETA)
- Airport intelligence (search by city, timezone, routes) — could replace our static IATA map
- Roadmap: car rentals, train search, activity booking, weather, visa requirements

**Value:** Integrate Amadeus flight search as Kiwi.com fallback. Airport search API could replace hardcoded `CITY_TO_AIRPORT` map.

---

### 5. [travel-hacking-toolkit](https://github.com/borski/travel-hacking-toolkit) — HIGH relevance

**What:** AI skill-based travel optimization with 6 MCP servers (Skiplagged, Kiwi, Trivago, Ferryhopper, Airbnb, LiteAPI), loyalty program analysis, and points valuation.

**Tech:** Python 82%, Shell 10%, 42 specialized skills, Docker + Playwright for browser automation, JSON reference data.

**Findings:**
- Multi-source flight comparison (GDS, REST APIs, browser automation, metasearch)
- Accommodation beyond hotels: Airbnb + Trivago for hostels/apartments/vacation rentals
- Ferry routes (Ferryhopper) — Mediterranean/Greek island destinations
- Reference data: JSON for airline alliances, mileage programs, transfer partners, award sweet spots
- Transfer path optimization for credit card points
- Cross-platform (Claude Code, OpenCode, Codex)

**Value:** Extract Skiplagged and Airbnb patterns for additional price sources. Reference data JSONs could enrich destination cards.

---

### 6. [tripper](https://github.com/embabel/tripper) — HIGH relevance

**What:** Travel planning agent generating personalized itineraries using Claude Sonnet + GPT-4.1-mini with deterministic planning, Airbnb integration, mapping, and real-time cost tracking.

**Tech:** Kotlin, Spring Boot, htmx, Embabel framework (domain-driven agents), Docker Compose, MCP tools.

**Findings:**
- Multi-LLM orchestration (different models for different tasks)
- Event streaming to UI showing real-time agent progress
- Cost transparency: displays LLM usage cost per run (~$0.10)
- Containerized MCP tool ecosystem for modular capabilities
- htmx-powered dynamic UI with itineraries, maps, and accommodation links

**Value:** Adopt SSE event streaming for suggest endpoint (progress indicators). Consider task-specific model routing. Map integration pattern relevant for our Leaflet future enhancement.

---

## Tier 2: Valuable Patterns

### 2. [ai-travel-agent](https://github.com/nirbar1985/ai-travel-agent) — HIGH relevance

**What:** Streamlit chatbot using LangGraph for multi-turn conversation, SerpAPI for Google Flights/Hotels data, SendGrid for HTML email itineraries.

**Tech:** Python 3.11.9, LangGraph, OpenAI, Streamlit, SerpAPI, SendGrid, Poetry.

**Findings:**
- Stateful multi-turn conversations (agent remembers context)
- Dynamic LLM selection for different tasks (conversation vs. email generation)
- Human-in-the-loop: users approve plans before email dispatch
- Automated HTML email generation with logos and booking links
- SerpAPI for live flight/hotel data (structured Google results)

**Value:** Email/PDF export feature (quick win). SerpAPI as another price source. Human-in-the-loop pattern for itinerary approval.

---

### 3. [TravelPlanner](https://github.com/OSU-NLP-Group/TravelPlanner) — MEDIUM-HIGH relevance

**What:** ICML'24 Spotlight benchmark for evaluating travel planning agents. Tests constraint satisfaction across transport, meals, attractions, accommodation.

**Tech:** Python 3.9, OpenAI (GPT-3.5/4), Gemini, Mistral, fine-tuned models (Llama-3.1-8B, Qwen2-7B), HuggingFace.

**Findings:**
- Two-stage planning: search-gather-plan (similar to our suggest → itinerary flow)
- Constraint categories: environment (does this exist?), commonsense (timing logic), hard (budget/travel time)
- Multiple prompting strategies: direct, chain-of-thought, ReAct, Reflexion
- Postprocessing pipeline: NL plans → structured JSON
- Automated evaluation with leaderboard submission

**Value:** Constraint validation categories for our itinerary validation. Commonsense constraints checklist (don't schedule dinner at 3am, etc.).

---

### 8. [ChinaTravel](https://github.com/LAMDA-NeSy/ChinaTravel) — HIGH relevance

**What:** IJCAI 2025/2026 benchmark for compositional constraint satisfaction in travel planning. Uses symbolic verification with LLM-Modulo approach.

**Tech:** Python 3.9, multiple LLM support (DeepSeek, GPT-4o, GLM4-Plus, local models), HuggingFace datasets.

**Findings:**
- Compositional constraint verification: validates ALL constraints simultaneously
- LLM-Modulo: generate with LLM, verify with symbolic checker (matches our pattern exactly)
- Executable DSL for constraints instead of ad-hoc checks
- Multiple difficulty splits (easy, medium, human-curated)
- Extensible agent framework with base classes

**Value:** Formalise our validation pipeline (schema → flight time → preference scoring) into a composable constraint system.

---

### 9. [TripCraft](https://github.com/Soumyabrata2003/TripCraft) — HIGH relevance

**What:** ACL 2025 benchmark measuring spatio-temporal coherence in LLM-generated itineraries. Enforces transit times, opening hours, meal timing, persona preferences.

**Tech:** Python, NVIDIA L40 GPU, GPT-4o for NL→JSON, JSONL evaluation data.

**Findings:**
- Five continuous metrics: Temporal Meal Score, Temporal Attraction Score, Spatial Score, Ordering Score, Persona Score
- Validates physical feasibility: transit timing, event hours, meal times, routing
- Multi-duration support (3/5/7-day itineraries)
- Built partially on TravelPlanner framework

**Value:** Spatio-temporal validation for our itinerary generation. "Spatial score" directly applicable to our cluster feature. Persona scoring validates preference matching.

---

## Tier 3: Lower Priority

### 1. [flyai-skill](https://github.com/alibaba-flyai/flyai-skill) — MEDIUM relevance

**What:** Alibaba's Fliggy travel search as MCP skill. Covers flights, trains, hotels, POIs, visas — China-focused.

**Tech:** Node.js, npm package (@fly-ai/flyai-cli), Fliggy MCP API, JSON output.

**Findings:**
- Eight specialized search commands (keyword, semantic, flights, trains, hotels, POIs, Marriott)
- Deep filtering (cabin class, price caps, time ranges, star ratings)
- Bookable results with direct links
- Zero-config startup

**Value:** China-centric data. Multi-command architecture pattern is interesting but not immediately applicable. Useful if expanding to Chinese domestic travel.

---

### 7. [travel-guide](https://github.com/zero-to-mastery/travel-guide) — LOW relevance

**What:** Basic React app with country info from REST Countries API. Activity suggestions, region-based browsing.

**Tech:** React 19, TypeScript, Vite, React Router v6, REST Countries API v3.1.

**Findings:**
- Country data lookup (population, capital, currency, timezone)
- Region-based destination browsing
- Modern Hooks-based React + TypeScript
- No AI, no pricing, no itinerary generation

**Value:** Minimal. REST Countries API could provide country metadata for destination cards but that's a nice-to-have.

---

### 4. [explainx.ai Claude Skills](https://explainx.ai/skills/ailabs-393/ai-labs-claude-skills/travel-planner) — UNABLE TO ACCESS

Gated/authenticated content. Not publicly accessible.

---

## Recommended Implementation Priorities

| # | Action | Source | Effort | Impact |
|---|--------|--------|--------|--------|
| 1 | Add progress streaming (SSE) to suggest endpoint | tripper | Medium | High (UX) |
| 2 | Integrate Amadeus flight search as Kiwi fallback | travel-mcp-server | Medium | High (data) |
| 3 | Add itinerary email/PDF export | ai-travel-agent | Small | Medium (feature) |
| 4 | Spatio-temporal validation for itineraries | TripCraft | Medium | High (quality) |
| 5 | Formalise constraint pipeline (composable rules) | ChinaTravel | Medium | Medium (maintainability) |
| 6 | Multi-source price comparison (Skiplagged, Airbnb) | travel-hacking-toolkit | Large | High (data) |
| 7 | Airport search API (replace static IATA map) | travel-mcp-server | Small | Medium (coverage) |
| 8 | Human-in-the-loop for itinerary approval | ai-travel-agent | Small | Medium (UX) |
