"use client";

import { useState, useCallback } from "react";
import TripPlannerForm from "@/components/TripPlannerForm";
import DestinationCard from "@/components/DestinationCard";
import BudgetSlider from "@/components/BudgetSlider";
import ItineraryView from "@/components/ItineraryView";
import ChatAgent from "@/components/ChatAgent";
import { TripPlannerInput, Destination, BudgetSplit, TripItinerary } from "@/lib/types";
import { ArrowLeft, MapPin, Sparkles, PlayCircle } from "lucide-react";

type AppStep = "form" | "destinations" | "itinerary";

function calculateDefaultBudgetSplit(budget: number): BudgetSplit {
  return {
    travel: Math.round(budget * 0.35),
    accommodation: Math.round(budget * 0.30),
    food: Math.round(budget * 0.15),
    activities: Math.round(budget * 0.12),
    misc: Math.round(budget * 0.08),
  };
}

export default function Home() {
  const [step, setStep] = useState<AppStep>("form");
  const [tripInput, setTripInput] = useState<TripPlannerInput | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selectedDestinations, setSelectedDestinations] = useState<Set<string>>(new Set());
  const [budgetSplit, setBudgetSplit] = useState<BudgetSplit | null>(null);
  const [itinerary, setItinerary] = useState<TripItinerary | null>(null);
  const [activeItineraryDest, setActiveItineraryDest] = useState<Destination | null>(null);
  const [isLoadingDestinations, setIsLoadingDestinations] = useState(false);
  const [isLoadingItinerary, setIsLoadingItinerary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

  const handleDemoMode = useCallback(async () => {
    setIsLoadingDemo(true);
    setError(null);
    try {
      const [destRes, inputRes] = await Promise.all([
        fetch("/api/demo?resource=destinations"),
        fetch("/api/demo?resource=input"),
      ]);
      const { destinations: demoDests } = await destRes.json();
      const { input: demoInput } = await inputRes.json();
      setTripInput(demoInput);
      setBudgetSplit(calculateDefaultBudgetSplit(demoInput.budget));
      setDestinations(demoDests);
      setStep("destinations");
    } catch {
      setError("Failed to load demo data. Please try again.");
    } finally {
      setIsLoadingDemo(false);
    }
  }, []);

  const handleFormSubmit = useCallback(async (input: TripPlannerInput) => {
    setIsLoadingDestinations(true);
    setError(null);
    setTripInput(input);
    setBudgetSplit(calculateDefaultBudgetSplit(input.budget));

    try {
      const response = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get destination suggestions");
      }

      setDestinations(data.destinations);
      setStep("destinations");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoadingDestinations(false);
    }
  }, []);

  const toggleDestinationSelection = useCallback((id: string) => {
    setSelectedDestinations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 2) {
          // Allow max 2 selections
          const first = next.values().next().value as string;
          next.delete(first);
        }
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleGenerateItinerary = useCallback(
    async (destination: Destination) => {
      if (!tripInput || !budgetSplit) return;

      setIsLoadingItinerary(true);
      setError(null);
      setActiveItineraryDest(destination);

      try {
        // Use the demo itinerary when the selected card is the Lisbon demo destination
        if (destination.id === "lisbon") {
          const demoRes = await fetch("/api/demo?resource=itinerary");
          const { itinerary: demoItin } = await demoRes.json();
          setItinerary(demoItin);
          setStep("itinerary");
          return;
        }

        const response = await fetch("/api/itinerary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destination: `${destination.city}, ${destination.country}`,
            input: tripInput,
            budgetSplit,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to generate itinerary");
        }

        setItinerary(data.itinerary);
        setStep("itinerary");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoadingItinerary(false);
      }
    },
    [tripInput, budgetSplit]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step !== "form" && (
              <button
                onClick={() => setStep(step === "itinerary" ? "destinations" : "form")}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="text-2xl">✈️</span>
              <span className="font-bold text-gray-900">Travel Planner AI</span>
            </div>
          </div>

          {/* Step Indicator */}
          <div className="hidden sm:flex items-center gap-2 text-sm">
            {(["form", "destinations", "itinerary"] as AppStep[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    step === s
                      ? "bg-blue-500 text-white"
                      : i < ["form", "destinations", "itinerary"].indexOf(step)
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  {i + 1}
                </div>
                {i < 2 && <div className="w-8 h-px bg-gray-200" />}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
            <span className="text-red-500 font-bold">⚠</span>
            <div>
              <strong>Error: </strong>{error}
              {error.includes("GROQ_API_KEY") && (
                <p className="mt-1 text-xs text-red-600">
                  Please set the GROQ_API_KEY environment variable. Get a free key at{" "}
                  <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="underline">
                    console.groq.com
                  </a>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 1: Trip Planning Form */}
        {step === "form" && (
          <div>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Plan Your Perfect Trip
              </h1>
              <p className="text-gray-500 max-w-lg mx-auto mb-4">
                Tell us your budget, dates, and preferences — we&apos;ll suggest perfect destinations
                and build a personalized itinerary just for you.
              </p>
              {/* Demo Mode Banner */}
              <div className="inline-flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3">
                <span className="text-sm text-amber-800">
                  No API key yet?{" "}
                  <strong>Preview the full app</strong> with a sample London → Lisbon trip
                </span>
                <button
                  onClick={handleDemoMode}
                  disabled={isLoadingDemo}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-1.5 rounded-xl transition-colors whitespace-nowrap"
                >
                  {isLoadingDemo ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <PlayCircle className="w-4 h-4" />
                  )}
                  Try Demo
                </button>
              </div>
            </div>
            <TripPlannerForm onSubmit={handleFormSubmit} isLoading={isLoadingDestinations} />
          </div>
        )}

        {/* Step 2: Destinations & Budget */}
        {step === "destinations" && tripInput && budgetSplit && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-amber-500" />
                Your Destination Matches
              </h2>
              <p className="text-gray-500 text-sm">
                Based on your {tripInput.budget.toLocaleString()} {tripInput.currency} budget from{" "}
                {tripInput.homeCity}. Select up to 2 to narrow down, then generate a full itinerary.
              </p>
              {destinations.some((d) => d.id === "lisbon") && (
                <div className="inline-flex items-center gap-1.5 mt-2 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-3 py-1">
                  <PlayCircle className="w-3.5 h-3.5" />
                  Demo mode — sample data. Click &quot;Plan Itinerary&quot; on Lisbon to see the full itinerary demo.
                </div>
              )}
            </div>

            {/* Budget Slider */}
            <BudgetSlider
              totalBudget={tripInput.budget}
              currency={tripInput.currency}
              split={budgetSplit}
              onChange={setBudgetSplit}
            />

            {/* Destination Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {destinations.map((dest, i) => (
                <DestinationCard
                  key={dest.id}
                  destination={dest}
                  isSelected={selectedDestinations.has(dest.id)}
                  onSelect={toggleDestinationSelection}
                  onGenerateItinerary={handleGenerateItinerary}
                  rank={i + 1}
                />
              ))}
            </div>

            {isLoadingItinerary && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-8 text-center max-w-sm mx-4">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="font-semibold text-gray-900">Building your itinerary...</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Creating a personalized day-by-day plan for{" "}
                    {activeItineraryDest?.city}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Itinerary */}
        {step === "itinerary" && itinerary && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <MapPin className="w-4 h-4" />
              <span>Itinerary for {itinerary.destination}</span>
            </div>
            <ItineraryView itinerary={itinerary} />
          </div>
        )}
      </main>

      {/* Chat Agent - always visible */}
      <ChatAgent
        tripContext={tripInput}
        destination={
          activeItineraryDest
            ? `${activeItineraryDest.city}, ${activeItineraryDest.country}`
            : undefined
        }
      />
    </div>
  );
}
