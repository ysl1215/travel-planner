# ✈️ Travel Planner AI

[![CI](https://github.com/ysl1215/travel-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/ysl1215/travel-planner/actions/workflows/ci.yml)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fysl1215%2Ftravel-planner&env=OPENROUTER_API_KEY&envDescription=Get%20a%20free%20key%20at%20openrouter.ai%2Fkeys&envLink=https%3A%2F%2Fopenrouter.ai%2Fkeys&project-name=travel-planner-ai&repository-name=travel-planner-ai)

An AI-powered travel planner that creates personalized destination suggestions and detailed day-by-day itineraries based on your budget, dates, travel preferences, and style.

---

## 🚀 Deploy in 2 minutes (Vercel — free)

> **Why not GitHub Pages?** GitHub Pages is static-only — it can't run the server-side Next.js API routes that power the AI features and demo mode. Vercel is the right home for full-stack Next.js apps and has a free tier.

### Option 1 — One-click deploy (fastest)

Click the button above **"Deploy with Vercel"**, then:
1. Vercel clones the repo to your GitHub account
2. Enter your `OPENROUTER_API_KEY` when prompted ([get a free key →](https://openrouter.ai/keys))
3. Click **Deploy** — your app is live in ~60 seconds at `https://your-app.vercel.app`

### Option 2 — Connect your existing repo to Vercel

1. Push this code to your own GitHub repository (if not already there)
2. Go to [vercel.com/new](https://vercel.com/new) and click **"Import Git Repository"**
3. Select your repo and click **Import**
4. Under **Environment Variables**, add:
   | Variable | Value |
   |---|---|
   | `OPENROUTER_API_KEY` | Your key from [openrouter.ai/keys](https://openrouter.ai/keys) |
5. Click **Deploy** — done! Every push to `main` auto-deploys

### Option 3 — Vercel CLI (from your terminal)

```bash
npm install -g vercel
vercel login
vercel deploy
# When prompted, paste your OPENROUTER_API_KEY
```

### Option 4 — Self-host (for full flight-price scraping)

Vercel serverless functions can't spawn Python subprocesses, so the live flight prices button won't work there. If you want the full experience including Google Flights prices:

```bash
# Railway / Render / Fly.io (all have free tiers)
# 1. Create a new Web Service pointed at this repo
# 2. Set build command:  npm install && pip install fast-flights && npm run build
# 3. Set start command:  npm run start
# 4. Add OPENROUTER_API_KEY as environment variable
# 5. Deploy
```

---

## 🏠 Run locally

### 1. Clone and install

```bash
git clone https://github.com/ysl1215/travel-planner.git
cd travel-planner
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
# Edit .env.local and add your OPENROUTER_API_KEY
# Get a free key at https://openrouter.ai/keys (no credit card needed)
```

### 3. (Optional) Install Python for live flight prices

```bash
pip install fast-flights
# Without this, the "Check live prices" button shows an error — everything else works fine.
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ▶️ Try the demo (no API key needed)

Click **"Try Demo"** on the landing page to load a pre-built sample trip (London → Lisbon, $4,000 USD, 7 days) with no setup required. You can explore all three screens:
- **Step 1 — Form**: budget, dates, activity preferences, travel style
- **Step 2 — Destinations**: 5 destination cards + live prices button + budget allocation chart
- **Step 3 — Itinerary**: full 7-day day-by-day plan with tabs (Itinerary · Attractions · Food · Tips)

---

## ✨ Features

### 1. Smart Trip Planning Form
- **Budget** with currency selection (USD, EUR, GBP, SGD, AUD, CAD, JPY)
- **Home city** — where you're travelling from (auto-mapped to IATA airport code)
- **Rough dates** with flexibility slider (±0–14 days) to find cheaper alternatives
- **Number of travellers**
- **Activity preferences** — activities you love & want to de-prioritise
- **Travel mode** — Flight, Train, Rental Car, Bus, Cruise
- **Travel style** — Budget Backpacker to Luxury
- **Optional**: preferred country/region, max travel time from home

### 2. AI Destination Suggestions
- 4–6 personalized destinations tailored to your budget & preferences
- Budget fit rating (Excellent / Good / Stretch)
- Highlights and vibe match tags
- Estimated flight hours from home city
- Best time to visit

### 3. Budget Allocation Slider
- Interactive split across Travel, Accommodation, Food, Activities, Misc
- Live pie chart updates as you drag
- Proportional redistribution logic

### 4. Day-by-Day Itinerary
- Full schedule split into morning / afternoon / evening
- Mix of top attractions + local, off-the-beaten-path experiences
- Wait times flagged for popular sites
- Food recommendations (no tourist traps!)
- Optimal routing with transit tips
- Four tabs: Itinerary · Attractions · Food · Practical Tips

### 5. Live Flight Prices (Google Flights)
- **"Check live prices"** button on each destination card
- Scraped in real-time from Google Flights via [fast-flights](https://github.com/AWeirdDev/flights) — **no API key needed**
- Shows airline, times, duration, stops, best-fare highlight
- Requires Python 3 + `pip install fast-flights` on the server

### 6. AI Chat Assistant
- Floating chat powered by any LLM on [OpenRouter](https://openrouter.ai) (100+ models, many free)
- Context-aware of your current destination and trip preferences
- Streaming responses

---

## ⚙️ Automatic CI/CD (GitHub Actions)

Two workflows are included in `.github/workflows/`:

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | Every push & PR | Runs `npm run build` + `npm run lint` |
| `deploy.yml` | Push to `main` + PRs | Deploys to Vercel (production/preview) |

### Setting up automatic Vercel deploys from GitHub Actions

If you want GitHub Actions to deploy to Vercel (instead of Vercel's native GitHub integration):

1. Run `vercel link` in your project directory to create `.vercel/project.json`
2. Add these **GitHub repository secrets** (Settings → Secrets and variables → Actions):

   | Secret | Where to find it |
   |---|---|
   | `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) |
   | `VERCEL_ORG_ID` | `.vercel/project.json` → `orgId` |
   | `VERCEL_PROJECT_ID` | `.vercel/project.json` → `projectId` |

3. Add `OPENROUTER_API_KEY` to your Vercel project's environment variables (Vercel dashboard → Settings → Environment Variables)

> **Tip:** For most users, Vercel's native GitHub integration (Option 2 above) is simpler — Vercel auto-deploys on every push without any GitHub secrets needed.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| AI | [OpenRouter](https://openrouter.ai) — 100+ models, free tier (Llama 3.3 70B default) |
| Flight prices | [fast-flights](https://github.com/AWeirdDev/flights) — Google Flights scraper (Python, no API key) |
| Charts | Recharts |
| Icons | Lucide React |
| Deployment | Vercel (recommended) / Railway / Render |

---

## 📁 Project Structure

```
travel-planner/
├── .github/
│   └── workflows/
│       ├── ci.yml          # Build + lint on every push/PR
│       └── deploy.yml      # Auto-deploy to Vercel
├── app/
│   ├── page.tsx            # Main app (form → destinations → itinerary)
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── suggest/        # POST — AI destination suggestions
│       ├── itinerary/      # POST — AI itinerary generation
│       ├── chat/           # POST — Streaming AI chat
│       ├── prices/         # GET  — Google Flights scraper (Python subprocess)
│       └── demo/           # GET  — Pre-seeded mock data (no API key)
├── components/
│   ├── TripPlannerForm.tsx
│   ├── DestinationCard.tsx # Includes live prices button
│   ├── BudgetSlider.tsx
│   ├── ItineraryView.tsx
│   └── ChatAgent.tsx
├── lib/
│   ├── airports.ts         # City → IATA airport code mapping
│   ├── openrouter.ts       # AI client (OpenRouter)
│   ├── prompts.ts          # AI prompt templates
│   ├── types.ts            # TypeScript types
│   └── mockData.ts         # Demo data (London → Lisbon, 7 days)
├── scripts/
│   └── google_flights.py   # Python wrapper around fast-flights
├── .env.local.example      # Copy to .env.local and fill in your key
└── vercel.json             # Vercel build config
```

---

## 🌐 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | **Yes** (for AI) | Free key from [openrouter.ai/keys](https://openrouter.ai/keys) |
| `OPENROUTER_MODEL` | No | Override the AI model (default: `meta-llama/llama-3.3-70b-instruct:free`) |

---

## �� Next Steps

1. **🗺️ Interactive map** — Leaflet + `route[]` array from itinerary for visual routing
2. **📅 Flexible date price heatmap** — cheapest weeks within user's flexibility window
3. **🌤️ Weather forecasts** — Open-Meteo (free, no key)
4. **🌍 Destination photos** — Unsplash API (`imageQuery` field already on every `Destination`)
5. **🧳 Packing list** — AI-generated, context-aware, export to PDF
6. **🔐 User accounts + saved trips** — Clerk/NextAuth + Vercel Postgres
7. **🏨 Hotel prices** — extend `scripts/google_flights.py` or add a hotels scraper
8. **📱 PWA** — service worker for offline itinerary access
9. **💬 Itinerary editing via chat** — AI returns structured diff to update itinerary in-place
