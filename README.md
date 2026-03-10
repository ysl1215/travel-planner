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
   - **Step 2 — Destinations**: 5 destination cards + interactive budget allocation pie chart
   - **Step 3 — Itinerary**: click "📋 Plan Itinerary" on Lisbon → full 7-day day-by-day plan
5. Switch between the four tabs on the itinerary screen (Itinerary · Attractions · Food · Tips).
6. Open the **chat bubble** (bottom-right) — the AI assistant is context-aware of your current destination.

### Option B — Live AI mode (with Groq API key)

```bash
cp .env.local.example .env.local
# Edit .env.local and add your GROQ_API_KEY
# Get a free key at https://console.groq.com (takes < 1 minute)
npm run dev
```

Fill in the form with your own trip details and click **"✈️ Find My Perfect Destinations"** to get real AI-generated suggestions and itineraries.

---

## Screenshots

| Step 1 — Trip Planning Form | Step 2 — Destination Matches |
|---|---|
| ![Form](https://github.com/user-attachments/assets/460b9c42-2af0-47f1-9abf-47dcb0bcb969) | ![Destinations](https://github.com/user-attachments/assets/9477f3af-d009-4035-af93-b8c81d0a1975) |

| Step 3 — Itinerary (Attractions tab) | Step 3 — Food tab + Chat agent |
|---|---|
| ![Attractions](https://github.com/user-attachments/assets/644b1747-551b-4074-b14a-3e479e987bb4) | ![Food + Chat](https://github.com/user-attachments/assets/a770a120-ea18-487a-bbb8-8406cedad21e) |

---

## What's implemented

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

### 5. AI Chat Assistant
- Floating chat powered by **Llama 3** (via Groq — free, open-weight)
- Aware of your trip context (budget, destination, preferences)
- Streaming responses
- Ask anything: local customs, visa info, safety tips, hidden gems

### 6. Real Travel & Hotel Prices (Optional)
- Integrates with **Amadeus API** (free test tier) for live flight and hotel prices

---

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **AI**: [Groq API](https://console.groq.com) — free, open-weight models (Llama 3.3 70B)
- **Travel Data**: [Amadeus API](https://developers.amadeus.com) — free test environment
- **Charts**: Recharts
- **Icons**: Lucide React

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
# Required: AI Chat & Destination Suggestions
# Get a free key at https://console.groq.com
GROQ_API_KEY=your_groq_api_key_here

# Optional: Real flight & hotel prices
# Get free test credentials at https://developers.amadeus.com
AMADEUS_CLIENT_ID=your_amadeus_client_id
AMADEUS_CLIENT_SECRET=your_amadeus_client_secret
```

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Integrations

| API | Purpose | Cost |
|-----|---------|------|
| [Groq](https://console.groq.com) | AI destination suggestions, itinerary generation, chat assistant | **Free** (open-weight models) |
| [Amadeus](https://developers.amadeus.com) | Flight & hotel price search | **Free** (test environment) |

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
│       ├── prices/           # GET /api/prices — Amadeus flight & hotel prices
│       └── demo/             # GET /api/demo — Pre-seeded mock data (no key needed)
├── components/
│   ├── TripPlannerForm.tsx   # Trip planning input form
│   ├── DestinationCard.tsx   # Destination suggestion card
│   ├── BudgetSlider.tsx      # Budget allocation with pie chart
│   ├── ItineraryView.tsx     # Day-by-day itinerary display
│   └── ChatAgent.tsx         # Floating AI chat window
└── lib/
    ├── types.ts              # TypeScript types
    ├── groq.ts               # Groq API client
    ├── prompts.ts            # AI prompt templates
    └── mockData.ts           # Demo data (London → Lisbon, 7 days)
```

---

## Next Steps

The following enhancements would make this production-ready. They are roughly ordered by priority.

### 🗺️ 1. Interactive map (high priority)
Leaflet and React-Leaflet are already installed — add a map view on the itinerary screen that plots the day's route, pins each attraction, and draws the optimal walking/transit path between stops. The `route` array in each itinerary already carries from/to/mode data ready for rendering.

### 🔐 2. User accounts & saved trips
Add authentication (Clerk or NextAuth) so users can save trips, revisit itineraries, and build a collection of past and planned journeys. Pair with a lightweight database (Vercel Postgres / Supabase) to persist trip data.

### 💰 3. Live price data — flights & hotels
The Amadeus `/api/prices` route is wired but needs real IATA city codes. Add a city-code lookup step (Amadeus Location API) to translate "London" → "LON" automatically. Surface the cheapest flight + hotel combinations directly on each destination card.

### 📅 4. Flexible date picker with price heatmap
Replace the plain date inputs with a calendar that highlights the cheapest available weeks within the user's flexibility window (using Amadeus or Google Flights data). This directly delivers the "rough dates → best value" goal from the original spec.

### 🌍 5. Review & content integration
Pull in real-world ratings and photos to enrich each destination and attraction card:
- **TripAdvisor API** (or community-maintained scrapers) — ratings, photos, review summaries
- **Wikivoyage** / **OpenTripMap** — free, open-licensed descriptions & POI data
- **Unsplash API** — free destination photos keyed to the `imageQuery` field already in every `Destination` object

### 🧳 6. Packing list generator
After the itinerary is finalised, have the AI generate a context-aware packing list (climate, activities, trip duration, number of days in transit). Exportable to a checklist.

### 💬 7. Richer chat — multi-turn trip refinement
Let users refine itinerary details through the chat (e.g. "swap Day 3 afternoon for a cooking class", "I'd prefer a cheaper lunch option on Day 5"). Have the AI return a structured diff that updates the itinerary in-place.

### 🌤️ 8. Weather forecasts
Integrate Open-Meteo (free, no key required) to show the forecast for the travel dates on each destination card and inside the itinerary.

### 🚀 9. One-click deployment to Vercel
Add a `vercel.json` config and a **Deploy to Vercel** button in the README so the app can be stood up with a single click. Vercel's environment variable UI makes it easy to add `GROQ_API_KEY` post-deploy.

### 📱 10. Progressive Web App (PWA)
Add a `manifest.json` and service worker so the itinerary is accessible offline — useful for travellers without roaming data.
