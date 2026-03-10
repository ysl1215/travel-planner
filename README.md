# ✈️ Travel Planner AI

An AI-powered travel planner that creates personalized destination suggestions and detailed itineraries based on your budget, dates, travel preferences, and style.

## Features

### 1. Smart Trip Planning Form
- **Budget** with currency selection (USD, EUR, GBP, SGD, AUD, CAD, JPY)
- **Home city** — where you're travelling from
- **Rough dates** with flexibility slider (±0–14 days) to maximize value
- **Number of travellers**
- **Activity preferences** — activities you love & want to de-prioritize
- **Travel mode** — Flight, Train, Rental Car, Bus, Cruise
- **Travel style** — Budget Backpacker to Luxury
- **Optional**: preferred country/region, max travel time from home

### 2. AI Destination Suggestions
- 4–6 destination recommendations tailored to your budget & preferences
- Budget fit rating (Excellent / Good / Stretch)
- Highlights and vibe match
- Estimated flight time from home city
- Best time to visit

### 3. Budget Allocation Slider
- Interactive budget split across Travel, Accommodation, Food, Activities, Misc
- Pie chart visualization with real-time updates
- Trade-off sliders for each category

### 4. Day-by-Day Itinerary
- Full day-by-day schedule (morning / afternoon / evening)
- Mix of top tourist attractions + local, off-the-beaten-path activities
- Wait times flagged for popular attractions
- Food & eatery recommendations (no tourist traps!)
- Optimal routing between locations
- Practical tips

### 5. AI Chat Assistant
- Floating chat powered by **Llama 3** (via Groq — free, open-weight)
- Aware of your trip context (budget, destination, preferences)
- Ask anything: local customs, visa info, safety tips, hidden gems

### 6. Real Travel & Hotel Prices (Optional)
- Integrates with **Amadeus API** (free test tier) for live flight and hotel prices

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
│       └── prices/           # GET /api/prices — Amadeus flight & hotel prices
├── components/
│   ├── TripPlannerForm.tsx   # Trip planning input form
│   ├── DestinationCard.tsx   # Destination suggestion card
│   ├── BudgetSlider.tsx      # Budget allocation with pie chart
│   ├── ItineraryView.tsx     # Day-by-day itinerary display
│   └── ChatAgent.tsx         # Floating AI chat window
└── lib/
    ├── types.ts              # TypeScript types
    ├── groq.ts               # Groq API client
    └── prompts.ts            # AI prompt templates
```
