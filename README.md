# ✈️ Travel Planner AI

An AI-powered travel planner that creates personalized destination suggestions and detailed itineraries based on your budget, dates, travel preferences, and style.

## How to check the output right now

### Option A — Demo mode (no API key needed)

1. Clone and install:
   ```bash
   git clone https://github.com/ysl1215/travel-planner.git
   cd travel-planner
   npm install
   npm run dev
   ```
2. Open **http://localhost:3000** in your browser.
3. Click the **"Try Demo ▶"** button on the landing page — it instantly loads a pre-built sample trip (London → Lisbon, $4,000 USD, 7 days) with **no API key required**.
4. Explore all three screens:
   - **Step 1 — Form**: budget, dates, activity preferences, travel style
   - **Step 2 — Destinations**: 5 destination cards + interactive budget allocation pie chart + "Check live prices" buttons (requires Python setup, see below)
   - **Step 3 — Itinerary**: click "📋 Plan Itinerary" on Lisbon → full 7-day day-by-day plan
5. Switch between the four tabs on the itinerary screen (Itinerary · Attractions · Food · Tips).
6. Open the **chat bubble** (bottom-right) — the AI assistant is context-aware of your current destination.

### Option B — Live AI mode (with OpenRouter API key)

```bash
cp .env.local.example .env.local
# Edit .env.local and add your OPENROUTER_API_KEY
# Get a free key at https://openrouter.ai/keys (takes < 1 minute)
npm run dev
```

Fill in the form with your own trip details and click **"✈️ Find My Perfect Destinations"** to get real AI-generated suggestions and itineraries.

---

## Features

### 1. Smart Trip Planning Form
- **Budget** with currency selection (USD, EUR, GBP, SGD, AUD, CAD, JPY)
- **Home city** — where you're travelling from
- **Rough dates** with flexibility slider (±0–14 days) to maximise value for money
- **Number of travellers**
- **Activity preferences** — activities you love & want to de-prioritise
- **Travel mode** — Flight, Train, Rental Car, Bus, Cruise
- **Travel style** — Budget Backpacker to Luxury
- **Optional**: preferred country/region, max travel time from home

### 2. AI Destination Suggestions
- 4–6 destination recommendations tailored to your budget & preferences
- Budget fit rating (Excellent / Good / Stretch)
- Highlights and vibe match tags
- Estimated flight time from home city
- Best time to visit

### 3. Budget Allocation Slider
- Interactive budget split across Travel, Accommodation, Food, Activities, Misc
- Pie chart visualisation with real-time updates
- Proportional redistribution as you drag any slider

### 4. Day-by-Day Itinerary
- Full day-by-day schedule (morning / afternoon / evening)
- Mix of top tourist attractions + local, off-the-beaten-path activities
- Wait times flagged for popular attractions
- Food & eatery recommendations (no tourist traps!)
- Optimal routing between locations
- Practical tips tab

### 5. Live Flight Prices (Google Flights)
- Each destination card has a **"Check live prices"** button
- Prices scraped from Google Flights via [fast-flights](https://github.com/AWeirdDev/flights) (no API key needed)
- Shows airline, departure/arrival times, duration, stops, and per-person price
- Highlights the "best" fare automatically
- **Requires Python 3 + `pip install fast-flights`** (see setup below)

### 6. AI Chat Assistant
- Floating chat powered by any LLM on **OpenRouter** (100+ models, many free)
- Aware of your trip context (budget, destination, preferences)
- Streaming responses
- Ask anything: local customs, visa info, safety tips, hidden gems

---

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **AI**: [OpenRouter](https://openrouter.ai) — 100+ models, many free (default: Llama 3.3 70B)
- **Flight prices**: [fast-flights](https://github.com/AWeirdDev/flights) — Google Flights scraper (Python, no API key)
- **Charts**: Recharts
- **Icons**: Lucide React

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/ysl1215/travel-planner.git
cd travel-planner
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
# Required: AI features (destination suggestions, itinerary, chat)
# Get a free key at https://openrouter.ai/keys
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Optional: override the default model (Llama 3.3 70B free)
# Any model from https://openrouter.ai/models works here
# OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
```

### 3. Install Python dependencies (for live flight prices)

```bash
pip install fast-flights
```

> The app works fully without this — live prices just won't be fetched. The demo mode and AI features are unaffected.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## How the Google Flights integration works

Flight prices are fetched by `scripts/google_flights.py`, a thin wrapper around the [fast-flights](https://github.com/AWeirdDev/flights) Python library.

**How fast-flights works:**
1. Encodes your query (origin/destination airports, dates, passengers) as a Protobuf binary
2. Base64-encodes it into the `tfs` URL parameter that Google Flights uses
3. Fetches `https://www.google.com/travel/flights?tfs=<encoded_query>` while impersonating a Chrome browser (TLS fingerprinting via `primp`)
4. Parses the HTML response to extract flight cards: airline, price, duration, stops

The Next.js `/api/prices` route spawns this Python script as a subprocess, captures its JSON output, and returns it to the browser. No Google API key is required.

**IATA airport codes:** The app automatically maps common city names (e.g. "London" → `LHR`, "Paris" → `CDG`) to IATA codes. If your city isn't in the built-in list, the live-prices button won't appear for that card — you can add your city in `components/DestinationCard.tsx` → `CITY_TO_AIRPORT`.

### Using the prices button

On the destinations screen, each card shows a **"Check live prices (XXX → YYY)"** button once the app can infer both airport codes. Click it to fetch current Google Flights prices for those dates. Results are cached per card for the session.

---

## API

| Route | Method | Purpose |
|---|---|---|
| `/api/suggest` | POST | AI destination suggestions (OpenRouter) |
| `/api/itinerary` | POST | AI day-by-day itinerary (OpenRouter) |
| `/api/chat` | POST | Streaming AI chat (OpenRouter) |
| `/api/prices` | GET | Live flight prices (Google Flights via Python) |
| `/api/demo` | GET | Pre-seeded mock data (no API key needed) |

---

## Project Structure

```
travel-planner/
├── app/
│   ├── page.tsx              # Main app page (form → destinations → itinerary)
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles
│   └── api/
│       ├── suggest/          # POST /api/suggest — AI destination suggestions
│       ├── itinerary/        # POST /api/itinerary — AI itinerary generation
│       ├── chat/             # POST /api/chat — Streaming AI chat
│       ├── prices/           # GET /api/prices — Google Flights scraper
│       └── demo/             # GET /api/demo — Pre-seeded mock data
├── components/
│   ├── TripPlannerForm.tsx   # Trip planning input form
│   ├── DestinationCard.tsx   # Destination card + live prices button
│   ├── BudgetSlider.tsx      # Budget allocation with pie chart
│   ├── ItineraryView.tsx     # Day-by-day itinerary display
│   └── ChatAgent.tsx         # Floating AI chat window
├── lib/
│   ├── types.ts              # TypeScript types
│   ├── openrouter.ts         # OpenRouter AI client (replaces groq.ts)
│   ├── prompts.ts            # AI prompt templates
│   └── mockData.ts           # Demo data (London → Lisbon, 7 days)
└── scripts/
    └── google_flights.py     # Python wrapper around fast-flights
```

---

## Next Steps

1. **🗺️ Interactive map** — Leaflet is already installed; `route[]` array in itinerary ready for rendering
2. **🔐 User accounts + saved trips** — Clerk/NextAuth + Vercel Postgres
3. **📅 Flexible date picker with price heatmap** — cheapest weeks within user's flexibility window
4. **🌍 Review & photo integration** — TripAdvisor, OpenTripMap, Unsplash (`imageQuery` field already on every `Destination`)
5. **🧳 Packing list generator** — AI-generated, context-aware, exportable
6. **💬 In-place itinerary editing via chat** — structured diff from AI updates itinerary without full regeneration
7. **🌤️ Weather forecasts** — Open-Meteo (free, no key)
8. **🚀 One-click Vercel deploy** — `vercel.json` + Deploy button (note: Python subprocess won't run on Vercel Edge; use a separate Python service or Vercel Python runtime)
9. **📱 PWA / offline** — service worker for offline itinerary access
10. **🏨 Hotel prices** — extend `scripts/google_flights.py` or add a hotels endpoint using a free scraping approach
