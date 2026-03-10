import { Destination, TripItinerary, TripPlannerInput } from "./types";

// ─── Demo trip input ────────────────────────────────────────────────────────
export const DEMO_INPUT: TripPlannerInput = {
  budget: 4000,
  currency: "USD",
  homeCity: "London",
  startDate: "2025-06-14",
  endDate: "2025-06-21",
  flexDays: 3,
  travelers: 2,
  likedActivities: ["Cultural Sites", "Food & Culinary", "History", "Local Markets"],
  dislikedActivities: ["Nightlife"],
  travelMode: ["Flight"],
  country: "",
  maxTravelHours: 10,
  travelStyle: "Mid-range Comfort",
};

// ─── Demo destinations ───────────────────────────────────────────────────────
export const DEMO_DESTINATIONS: Destination[] = [
  {
    id: "lisbon",
    country: "Portugal",
    city: "Lisbon",
    region: "Estremadura",
    rationale:
      "Lisbon is one of Europe's best-value capitals — your $4,000 budget for 2 people comfortably covers return flights from London (~$150 pp), a well-located 3-star hotel ($80–100/night), daily meals, and plenty of day-trip options. June is warm and sunny, peak-season deals still available in early June.",
    highlights: [
      "Alfama historic district & São Jorge Castle",
      "Pastéis de Belém & Fado music",
      "Sintra day trip",
      "Tram 28 & miradouros (viewpoints)",
    ],
    estimatedFlightHours: 2.5,
    estimatedBudgetFit: "excellent",
    bestTimeToVisit: "Apr – Jun & Sep – Oct",
    vibeMatch: ["Cultural Sites", "Food & Culinary", "History", "Local Markets"],
    imageQuery: "Lisbon Portugal Alfama rooftops",
  },
  {
    id: "krakow",
    country: "Poland",
    city: "Kraków",
    region: "Małopolska",
    rationale:
      "Kraków offers exceptional value — one of the most historically rich cities in Europe at a fraction of Western European prices. Your budget stretches very far: flights are under $100 pp from London, accommodation $40–60/night, and exceptional food & culture for pennies. June weather is perfect.",
    highlights: [
      "Wawel Castle & Cathedral",
      "Auschwitz-Birkenau memorial day trip",
      "Kazimierz Jewish Quarter",
      "Wieliczka Salt Mine",
    ],
    estimatedFlightHours: 2.5,
    estimatedBudgetFit: "excellent",
    bestTimeToVisit: "May – Sep",
    vibeMatch: ["History", "Cultural Sites", "Local Markets", "Food & Culinary"],
    imageQuery: "Krakow Old Town Main Square Poland",
  },
  {
    id: "athens",
    country: "Greece",
    city: "Athens",
    region: "Attica",
    rationale:
      "Athens combines ancient history with a vibrant modern food scene. Flights from London are ~$120–180 pp in June, hotels $70–90/night in Monastiraki or Psirri. Your budget allows the Acropolis, island day trips, and excellent taverna dining without stretching. Early June avoids peak summer heat.",
    highlights: [
      "Acropolis & Parthenon",
      "Athens Central Market (Varvakios)",
      "Plaka & Monastiraki",
      "Cape Sounion day trip",
    ],
    estimatedFlightHours: 3.5,
    estimatedBudgetFit: "good",
    bestTimeToVisit: "Apr – Jun & Sep – Oct",
    vibeMatch: ["History", "Cultural Sites", "Food & Culinary", "Local Markets"],
    imageQuery: "Athens Acropolis Parthenon Greece",
  },
  {
    id: "porto",
    country: "Portugal",
    city: "Porto",
    region: "Norte",
    rationale:
      "Porto is slightly less touristy than Lisbon but equally charming — and cheaper. Famous for Port wine, azulejo-tiled facades, and superb seafood. Flights from London ~$100 pp, boutique guesthouses $60–80/night. A perfect mix of culture, gastronomy, and history on a comfortable budget.",
    highlights: [
      "Ribeira waterfront & Dom Luís I Bridge",
      "Port wine cellars in Vila Nova de Gaia",
      "Livraria Lello (famous bookshop)",
      "São Bento railway station azulejos",
    ],
    estimatedFlightHours: 2.5,
    estimatedBudgetFit: "excellent",
    bestTimeToVisit: "May – Oct",
    vibeMatch: ["Food & Culinary", "History", "Cultural Sites", "Local Markets"],
    imageQuery: "Porto Ribeira waterfront Portugal",
  },
  {
    id: "budapest",
    country: "Hungary",
    city: "Budapest",
    region: "Central Hungary",
    rationale:
      "Budapest is the 'Paris of the East' — stunning architecture, world-class thermal baths, a thriving food scene, and among the most affordable capitals in Europe. Flights under $80 pp from London, hotels $50–70/night. Your $4,000 budget leaves plenty for day trips and memorable ruin-bar evenings.",
    highlights: [
      "Buda Castle & Fisherman's Bastion",
      "Széchenyi or Gellért thermal baths",
      "Great Market Hall",
      "Ruin bars (Szimpla Kert)",
    ],
    estimatedFlightHours: 2.5,
    estimatedBudgetFit: "excellent",
    bestTimeToVisit: "Apr – Jun & Sep – Oct",
    vibeMatch: ["History", "Cultural Sites", "Food & Culinary", "Local Markets"],
    imageQuery: "Budapest Parliament building Danube at night",
  },
];

// ─── Demo itinerary (Lisbon, 7 nights) ────────────────────────────────────
export const DEMO_ITINERARY: TripItinerary = {
  destination: "Lisbon, Portugal",
  totalDays: 7,
  overview:
    "Seven days in Lisbon covering the historic Alfama district, Belém monuments, the hill neighbourhoods of Bairro Alto and Mouraria, a day trip to Sintra's fairytale palaces, and excellent local eating throughout. Designed for a couple on a mid-range comfort budget.",
  bestTimeToVisit:
    "June–July for warm sunny days (25–30°C). Book Sintra tickets online 2+ days ahead — it sells out.",
  days: [
    {
      day: 1,
      location: "Lisbon — Alfama",
      theme: "Arrival & the old city",
      morning: [
        {
          time: "10:00 AM",
          activity: "Check in & neighbourhood stroll",
          location: "Baixa / Rossio area",
          duration: "1.5 hours",
          cost: "Free",
          tips: "Drop your bags even before check-in and walk to Praça do Comércio by the river.",
          type: "accommodation",
        },
      ],
      afternoon: [
        {
          time: "1:00 PM",
          activity: "Lunch at Tasca do Chico",
          location: "Rua do Diário de Notícias 39, Bairro Alto",
          duration: "1.5 hours",
          cost: "~$20 per person",
          tips: "Book ahead — a genuine tasca (tiny neighbourhood restaurant) beloved by locals.",
          type: "food",
        },
        {
          time: "3:00 PM",
          activity: "São Jorge Castle",
          location: "Alfama hilltop",
          duration: "2 hours",
          cost: "$10 pp (book online)",
          tips: "Arrive before 4 PM on a weekday to avoid the worst queues. Views across all of Lisbon are stunning.",
          type: "attraction",
        },
      ],
      evening: [
        {
          time: "7:00 PM",
          activity: "Fado show dinner",
          location: "A Baiuca, Rua de São Miguel 20, Alfama",
          duration: "3 hours",
          cost: "~$40 pp",
          tips: "Reserve by phone a day ahead. Tiny venue — intimate, authentic Fado, not touristy.",
          type: "activity",
        },
      ],
      travelNote: "Tram 28E from Martim Moniz to Alfama — iconic but crowded; watch for pickpockets.",
      accommodation: "Stay central: Baixa, Chiado, or Mouraria neighbourhood",
    },
    {
      day: 2,
      location: "Lisbon — Belém",
      theme: "Age of Exploration monuments",
      morning: [
        {
          time: "9:00 AM",
          activity: "Pastéis de Belém — original custard tarts",
          location: "Rua de Belém 84–92",
          duration: "30 minutes",
          cost: "$2 per tart",
          tips:
            "Go early (before 10 AM) to avoid a 30-min queue. These are the original recipe, made since 1837.",
          type: "food",
        },
        {
          time: "10:00 AM",
          activity: "Jerónimos Monastery",
          location: "Praça do Império, Belém",
          duration: "1.5 hours",
          cost: "$10 pp",
          waitTime: "20–40 min in summer",
          tips: "UNESCO World Heritage Site — Manueline architecture at its finest. Book online.",
          type: "attraction",
        },
      ],
      afternoon: [
        {
          time: "12:30 PM",
          activity: "Lunch at Solar dos Presuntos",
          location: "Rua das Portas de Santo Antão 150",
          duration: "1.5 hours",
          cost: "~$18 pp",
          tips: "Classic Portuguese cooking, popular with locals. Try bacalhau (salt cod) or caldo verde.",
          type: "food",
        },
        {
          time: "2:30 PM",
          activity: "Tower of Belém",
          location: "Avenida Brasília, Belém",
          duration: "1 hour",
          cost: "$6 pp",
          waitTime: "30–45 min queue",
          tips: "Buy tickets online. The exterior and surroundings are equally impressive from outside.",
          type: "attraction",
        },
        {
          time: "4:00 PM",
          activity: "Monument to the Discoveries",
          location: "Avenida Brasília, Belém",
          duration: "45 minutes",
          cost: "$5 pp (rooftop viewpoint)",
          tips: "The compass rose mosaic on the pavement outside is a free photo opportunity.",
          type: "attraction",
        },
      ],
      evening: [
        {
          time: "7:30 PM",
          activity: "Dinner at O Corvo",
          location: "Rua Coelho da Rocha 85, Campo de Ourique",
          duration: "2 hours",
          cost: "~$25 pp",
          tips: "Small neighbourhood wine bar with excellent petiscos (tapas). Very local crowd.",
          type: "food",
        },
      ],
      travelNote: "Take the 15E tram or Uber to Belém (~15 min from Praça do Comércio, $3 by Uber).",
    },
    {
      day: 3,
      location: "Sintra (day trip)",
      theme: "Fairytale palaces in the hills",
      morning: [
        {
          time: "8:30 AM",
          activity: "Train to Sintra",
          location: "Rossio Station → Sintra Station",
          duration: "40 minutes",
          cost: "$2.50 pp each way",
          tips:
            "Leave early — Sintra fills up by 11 AM. Trains every 20 min from Rossio Station.",
          type: "transport",
        },
        {
          time: "9:30 AM",
          activity: "Pena Palace",
          location: "Estrada da Pena, Sintra",
          duration: "2 hours",
          cost: "$17 pp — MUST pre-book online",
          waitTime: "No wait if pre-booked; 1–2 hr queue without tickets",
          tips:
            "Book tickets 2–3 days ahead — they sell out. The walk up from the old town takes 30 min or take Bus 434 ($5).",
          type: "attraction",
        },
      ],
      afternoon: [
        {
          time: "12:00 PM",
          activity: "Lunch at Tasca do Galeão",
          location: "Rua dos Ferreiros 4, Sintra",
          duration: "1 hour",
          cost: "~$15 pp",
          tips: "Down a cobblestone lane away from the main tourist drag — far better value and quality.",
          type: "food",
        },
        {
          time: "2:00 PM",
          activity: "Moorish Castle",
          location: "Rua do Castelo, Sintra",
          duration: "1.5 hours",
          cost: "$9 pp",
          tips:
            "The walls are walkable and offer panoramic views. Combo ticket with Pena Palace saves money.",
          type: "attraction",
        },
        {
          time: "4:00 PM",
          activity: "Quinta da Regaleira — secret garden & initiatic well",
          location: "Rua Barbosa do Bocage 5, Sintra",
          duration: "1.5 hours",
          cost: "$8 pp",
          tips:
            "A hidden gem. The spiral staircase descending 27m underground is unforgettable. Book ahead.",
          type: "attraction",
        },
      ],
      evening: [
        {
          time: "7:00 PM",
          activity: "Return train to Lisbon & dinner at A Cevicheria",
          location: "Rua Dom Pedro V 129, Príncipe Real",
          duration: "2 hours",
          cost: "~$30 pp",
          tips:
            "One of Lisbon's best contemporary restaurants — elevated Portuguese-Peruvian fusion. Book well ahead.",
          type: "food",
        },
      ],
    },
    {
      day: 4,
      location: "Lisbon — Mouraria & LX Factory",
      theme: "Local neighbourhoods & creative scene",
      morning: [
        {
          time: "9:30 AM",
          activity: "Mouraria morning walk & Intendente square",
          location: "Mouraria district",
          duration: "2 hours",
          cost: "Free",
          tips:
            "Lisbon's oldest multicultural neighbourhood. Far fewer tourists than Alfama but equally atmospheric.",
          type: "activity",
        },
        {
          time: "11:30 AM",
          activity: "Time Out Market",
          location: "Avenida 24 de Julho 49",
          duration: "1.5 hours",
          cost: "$10–15 pp",
          tips:
            "Yes it's touristy, but the food quality from resident chefs is genuinely excellent — and you can graze on petiscos.",
          type: "food",
        },
      ],
      afternoon: [
        {
          time: "2:00 PM",
          activity: "LX Factory weekend market",
          location: "Rua Rodrigues de Faria 103",
          duration: "2.5 hours",
          cost: "Free entry, budget for shopping",
          tips:
            "Only on Sundays (or check their programme). Vintage shops, handmade goods, street food — very local vibe.",
          type: "activity",
        },
        {
          time: "5:00 PM",
          activity: "Miradouro da Graça sunset viewpoint",
          location: "Largo da Graça, Graça",
          duration: "1 hour",
          cost: "Free",
          tips:
            "Locals' favourite viewpoint — far less crowded than Portas do Sol. Bring a beer from the kiosk.",
          type: "attraction",
        },
      ],
      evening: [
        {
          time: "8:00 PM",
          activity: "Dinner at Taberna da Rua das Flores",
          location: "Rua das Flores 103",
          duration: "2 hours",
          cost: "~$22 pp",
          tips:
            "No reservations taken — arrive at opening. Seasonal small plates, natural wine, extremely local.",
          type: "food",
        },
      ],
    },
    {
      day: 5,
      location: "Lisbon — Museums & Príncipe Real",
      theme: "Art, antiques, and afternoon tea",
      morning: [
        {
          time: "10:00 AM",
          activity: "National Tile Museum (Museu Nacional do Azulejo)",
          location: "Rua Me Deus 4, Xabregas",
          duration: "2 hours",
          cost: "$6 pp",
          tips:
            "An underrated gem. The 36-metre panoramic tile panel of pre-earthquake Lisbon alone is worth the visit.",
          type: "attraction",
        },
      ],
      afternoon: [
        {
          time: "1:00 PM",
          activity: "Lunch at Zé da Mouraria",
          location: "Rua João do Outeiro 24, Mouraria",
          duration: "1.5 hours",
          cost: "~$12 pp",
          tips:
            "Tiny spot, lunch only, cash preferred. Possibly the best-value home-style Portuguese food in the city.",
          type: "food",
        },
        {
          time: "3:00 PM",
          activity: "Príncipe Real antiques market & gardens",
          location: "Jardim do Príncipe Real",
          duration: "1.5 hours",
          cost: "Free (bring cash for market)",
          tips: "Farmers market on Saturdays, antiques on weekends. Great for Portuguese ceramics and prints.",
          type: "activity",
        },
        {
          time: "5:00 PM",
          activity: "Museu Berardo (modern art, free)",
          location: "Praça do Império, Belém",
          duration: "1.5 hours",
          cost: "Free",
          tips:
            "Impressive collection of modern art including Warhol, Lichtenstein, Picasso. No booking needed.",
          type: "attraction",
        },
      ],
      evening: [
        {
          time: "8:00 PM",
          activity: "Dinner at Tasca do Chico (book for second visit)",
          location: "Rua do Diário de Notícias 39",
          duration: "2 hours",
          cost: "~$20 pp",
          tips: "If you loved it on Day 1, book a return visit — the daily specials change.",
          type: "food",
        },
      ],
    },
    {
      day: 6,
      location: "Cascais & Estoril (day trip)",
      theme: "Coastal escape",
      morning: [
        {
          time: "9:00 AM",
          activity: "Train to Cascais via scenic Estoril coast",
          location: "Cais do Sodré Station → Cascais",
          duration: "40 minutes",
          cost: "$2.50 pp",
          tips:
            "The line hugs the coast — sit on the right side heading west for sea views. Trains every 20 min.",
          type: "transport",
        },
        {
          time: "10:00 AM",
          activity: "Cascais old town & marina walk",
          location: "Cascais",
          duration: "2 hours",
          cost: "Free",
          tips:
            "Far more relaxed than Lisbon. Explore the fishing harbour, citadel, and local market.",
          type: "activity",
        },
      ],
      afternoon: [
        {
          time: "12:30 PM",
          activity: "Seafood lunch at O Pipas",
          location: "Rua das Flores 18, Cascais",
          duration: "1.5 hours",
          cost: "~$22 pp",
          tips: "Excellent fresh seafood. Try percebes (barnacles) or grilled sea bass with local wine.",
          type: "food",
        },
        {
          time: "2:30 PM",
          activity: "Boca do Inferno cliff walk",
          location: "30-min walk west of Cascais centre",
          duration: "1.5 hours",
          cost: "Free",
          tips: "Walk the coastal trail west out of town — dramatic rock arches and Atlantic sea spray.",
          type: "activity",
        },
        {
          time: "5:00 PM",
          activity: "Estoril Casino exterior & gardens",
          location: "Estoril",
          duration: "45 minutes",
          cost: "Free (exterior)",
          tips: "Said to have inspired Ian Fleming's Casino Royale. Beautiful gardens facing the sea.",
          type: "attraction",
        },
      ],
      evening: [
        {
          time: "7:30 PM",
          activity: "Return train & farewell dinner at Cervejaria Ramiro",
          location: "Avenida Almirante Reis 1, Lisbon",
          duration: "2.5 hours",
          cost: "~$35 pp",
          tips:
            "Lisbon's most celebrated seafood restaurant. Go for garlic prawns, lobster, and a cold Sagres. Queues outside but they move fast.",
          type: "food",
        },
      ],
    },
    {
      day: 7,
      location: "Lisbon — Departure day",
      theme: "Final morning & airport",
      morning: [
        {
          time: "8:00 AM",
          activity: "Breakfast at A Padaria Portuguesa",
          location: "Nearest branch to your hotel",
          duration: "45 minutes",
          cost: "~$6 pp",
          tips: "The best local bakery chain — galão coffee, cheese toast, and pastries. Much better than hotel breakfast.",
          type: "food",
        },
        {
          time: "9:00 AM",
          activity: "Final souvenir shopping — Conserveira de Lisboa",
          location: "Rua dos Bacalhoeiros 34",
          duration: "30 minutes",
          cost: "Budget for canned fish & wine",
          tips: "The iconic family-run tinned fish shop since 1930. Best artisan canned sardines in Portugal.",
          type: "activity",
        },
      ],
      afternoon: [
        {
          time: "11:30 AM",
          activity: "Metro or Uber to Lisbon Airport",
          location: "Aeroporto Humberto Delgado",
          duration: "30 minutes",
          cost: "$2 by metro (Red Line) or $15 by Uber",
          tips: "Red Line metro direct to airport in 20 min — much faster than road in daytime traffic.",
          type: "transport",
        },
      ],
      evening: [],
    },
  ],
  topAttractions: [
    {
      name: "Jerónimos Monastery",
      type: "culture",
      description:
        "A masterpiece of Manueline architecture built to celebrate Vasco da Gama's voyage to India. The cloisters are breathtaking.",
      estimatedDuration: "1.5–2 hours",
      waitTime: "20–40 min without pre-booking in summer",
      tips: "Pre-book online — saves significant queue time and costs the same.",
      offBeatenPath: false,
      cost: "moderate",
    },
    {
      name: "Quinta da Regaleira",
      type: "nature",
      description:
        "Mysterious estate in Sintra with symbolic underground wells, romantic gardens, and Templar iconography.",
      estimatedDuration: "1.5–2 hours",
      waitTime: "15 min",
      tips: "Book ahead online. Visit late afternoon for better photos without crowds.",
      offBeatenPath: true,
      cost: "cheap",
    },
    {
      name: "National Tile Museum",
      type: "culture",
      description:
        "World's finest collection of Portuguese azulejo tiles spanning 500 years, housed in a stunning 16th-century convent.",
      estimatedDuration: "1.5–2 hours",
      waitTime: "Minimal",
      tips: "Often overlooked by tourists — one of the best museums in Lisbon.",
      offBeatenPath: true,
      cost: "cheap",
    },
    {
      name: "São Jorge Castle",
      type: "tourist",
      description:
        "Moorish hilltop castle dominating the Alfama skyline with sweeping views over Lisbon and the Tagus.",
      estimatedDuration: "1.5–2 hours",
      waitTime: "30 min on weekends",
      tips: "Early morning or late afternoon avoids the worst crowds and light is best for photos.",
      offBeatenPath: false,
      cost: "moderate",
    },
    {
      name: "Miradouro da Graça",
      type: "local",
      description:
        "Locals' favourite viewpoint above Alfama — panoramic views with a kiosk bar. Far less crowded than Portas do Sol.",
      estimatedDuration: "30–45 minutes",
      tips: "Golden hour (7–8 PM in June) is magical. Bring your own snacks.",
      offBeatenPath: true,
      cost: "free",
    },
  ],
  foodRecommendations: [
    {
      name: "Tasca do Chico",
      cuisine: "Portuguese",
      description:
        "Tiny neighbourhood tasca with genuine home cooking. Known as one of the best Fado dinner experiences that doesn't feel staged.",
      priceRange: "$18–25 per person",
      mustTry: ["Bacalhau à brás", "Caldo verde", "Arroz de pato"],
      touristTrap: false,
      location: "Bairro Alto",
    },
    {
      name: "A Cevicheria",
      cuisine: "Portuguese-Peruvian fusion",
      description:
        "Chef Kiko Martins's flagship — creative small plates with exceptional ingredients. Book well in advance.",
      priceRange: "$35–45 per person",
      mustTry: ["Ceviche do dia", "Pica pau de polvo", "Nata cevicheria"],
      touristTrap: false,
      location: "Príncipe Real",
    },
    {
      name: "Zé da Mouraria",
      cuisine: "Traditional Portuguese",
      description:
        "Cash-only lunch spot serving daily specials to local workers and in-the-know visitors. No menu — just eat what's cooked.",
      priceRange: "$9–12 per person (lunch only)",
      mustTry: ["Dish of the day", "House wine"],
      touristTrap: false,
      location: "Mouraria",
    },
    {
      name: "Cervejaria Ramiro",
      cuisine: "Seafood",
      description:
        "Lisbon institution since 1956. Not cheap but outstanding quality — the garlic prawns and percebes (barnacles) are legendary.",
      priceRange: "$35–55 per person",
      mustTry: ["Gambas al ajillo", "Percebes", "Sapateira (spider crab)"],
      touristTrap: false,
      location: "Intendente",
    },
    {
      name: "Taberna da Rua das Flores",
      cuisine: "Contemporary Portuguese",
      description:
        "No reservations, first-come-first-served. Seasonal small plates and superb natural wine list.",
      priceRange: "$22–30 per person",
      mustTry: ["Seasonal petiscos", "Cured meats", "Natural wine selection"],
      touristTrap: false,
      location: "Chiado",
    },
  ],
  route: [
    { from: "Lisbon Centre", to: "Belém", mode: "Tram 15E or Uber", duration: "15–20 min", cost: "$2.50 (tram) / $5 (Uber)", tips: "Tram is scenic but slow — Uber is faster" },
    { from: "Rossio Station", to: "Sintra", mode: "CP Train", duration: "40 min", cost: "$2.50 pp each way", tips: "Direct, every 20 min; book Sintra attraction tickets separately online" },
    { from: "Cais do Sodré", to: "Cascais", mode: "CP Train (Estoril Line)", duration: "40 min", cost: "$2.50 pp", tips: "Sit on the right side going west — sea views the whole way" },
    { from: "Lisbon Centre", to: "Lisbon Airport", mode: "Metro (Red Line)", duration: "20–25 min", cost: "$2 pp", tips: "Direct from Aeroporto station — no changes needed" },
    { from: "Alfama", to: "Príncipe Real", mode: "Walk or Tram 28E + walk", duration: "25 min walk", cost: "Free", tips: "The walk through Chiado and Bairro Alto is pleasant" },
  ],
  practicalTips: [
    "Buy a rechargeable 'Viva Viagem' metro card on arrival (~$0.50) and top it up — much cheaper than buying individual tickets.",
    "Book Sintra attractions (Pena Palace, Quinta da Regaleira) 2–3 days ahead online. They genuinely sell out.",
    "Restaurants open late: lunch 1–3 PM, dinner 8–10 PM. Eating before 7:30 PM often means tourist menus only.",
    "Taxis and Ubers are cheap by Western European standards — typically $5–10 for cross-city trips.",
    "June days are long (sunset ~9 PM) — plan viewpoint visits for golden hour (8–9 PM).",
    "Portugal uses Euro (€). Most places accept cards but small tascas are cash-only.",
    "Lisbon has significant pickpocket issues on Tram 28E and in Alfama. Use a money belt or leave valuables in the hotel.",
    "Tap water is safe to drink everywhere in Lisbon.",
    "The Lisboa Card (~$25/24h) offers unlimited public transport + free/discounted museum entry — worthwhile if you plan to do many museums.",
    "English is widely spoken in Lisbon, even in local restaurants and markets.",
  ],
};
