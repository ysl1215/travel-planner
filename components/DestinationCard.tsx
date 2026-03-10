"use client";

import { useState } from "react";
import { Destination, FlightOffer } from "@/lib/types";
import { cityToAirport } from "@/lib/airports";
import { Globe, Clock, TrendingUp, CheckCircle, Plane, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface DestinationCardProps {
  destination: Destination;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onGenerateItinerary: (destination: Destination) => void;
  rank: number;
  /** IATA airport codes for the departure city (e.g. "LHR") */
  originAirport?: string;
  /** Departure date YYYY-MM-DD */
  departureDate?: string;
  /** Return date YYYY-MM-DD (optional – omit for one-way price check) */
  returnDate?: string;
  /** Number of adults */
  adults?: number;
  /** Currency */
  currency?: string;
}

const budgetFitColors = {
  excellent: "text-emerald-600 bg-emerald-50 border-emerald-200",
  good: "text-blue-600 bg-blue-50 border-blue-200",
  stretch: "text-amber-600 bg-amber-50 border-amber-200",
};

const budgetFitLabels = {
  excellent: "Excellent budget fit",
  good: "Good budget fit",
  stretch: "Bit of a stretch",
};


export default function DestinationCard({
  destination,
  isSelected,
  onSelect,
  onGenerateItinerary,
  rank,
  originAirport,
  departureDate,
  returnDate,
  adults = 1,
  currency = "USD",
}: DestinationCardProps) {
  const [priceData, setPriceData] = useState<{
    flights: FlightOffer[];
    priceLevel: string;
    error: string | null;
  } | null>(null);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [showPrices, setShowPrices] = useState(false);

  // Derive destination airport code
  const destAirport = cityToAirport(destination.city);

  const canFetchPrices = !!(originAirport && destAirport && departureDate);

  const handleFetchPrices = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (priceData) {
      setShowPrices((v) => !v);
      return;
    }
    setLoadingPrices(true);
    setShowPrices(true);
    try {
      const params = new URLSearchParams({
        origin: originAirport!,
        destination: destAirport!,
        departure: departureDate!,
        adults: String(adults),
        currency,
      });
      if (returnDate) params.set("return", returnDate);

      const res = await fetch(`/api/prices?${params}`);
      const data = await res.json();

      setPriceData({
        flights: data.flights ?? [],
        priceLevel: data.currentPriceLevel ?? "",
        error: data.error ?? null,
      });
    } catch (err) {
      setPriceData({
        flights: [],
        priceLevel: "",
        error: err instanceof Error ? err.message : "Failed to fetch prices",
      });
    } finally {
      setLoadingPrices(false);
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border-2 transition-all cursor-pointer hover:shadow-md ${
        isSelected ? "border-emerald-400 shadow-emerald-100" : "border-gray-100"
      }`}
      onClick={() => onSelect(destination.id)}
    >
      {/* Header */}
      <div className="relative bg-gradient-to-br from-slate-700 to-slate-900 rounded-t-2xl p-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">#{rank}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full border font-medium ${budgetFitColors[destination.estimatedBudgetFit]}`}
              >
                {budgetFitLabels[destination.estimatedBudgetFit]}
              </span>
            </div>
            <h3 className="text-2xl font-bold">{destination.city}</h3>
            <div className="flex items-center gap-1 text-gray-300 text-sm">
              <Globe className="w-4 h-4" />
              <span>{destination.country}</span>
              {destination.region && <span>· {destination.region}</span>}
            </div>
          </div>
          {isSelected && (
            <CheckCircle className="w-7 h-7 text-emerald-400 flex-shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-4 mt-3 text-sm text-gray-300">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>~{destination.estimatedFlightHours}h flight</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            <span>{destination.bestTimeToVisit}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <p className="text-gray-700 text-sm leading-relaxed mb-4">{destination.rationale}</p>

        {/* Highlights */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Highlights
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {destination.highlights.map((h, i) => (
              <span
                key={i}
                className="text-xs bg-gray-50 text-gray-600 border border-gray-200 rounded-full px-2.5 py-1"
              >
                {h}
              </span>
            ))}
          </div>
        </div>

        {/* Vibe Match */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Your vibe match
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {destination.vibeMatch.map((v, i) => (
              <span
                key={i}
                className="text-xs bg-violet-50 text-violet-600 border border-violet-200 rounded-full px-2.5 py-1"
              >
                ✓ {v}
              </span>
            ))}
          </div>
        </div>

        {/* Live Flight Prices */}
        {canFetchPrices && (
          <div className="mb-4">
            <button
              onClick={handleFetchPrices}
              className="w-full flex items-center justify-between text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2 hover:bg-sky-100 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                {loadingPrices ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plane className="w-3.5 h-3.5" />
                )}
                {loadingPrices
                  ? "Fetching live prices…"
                  : priceData
                  ? `Live prices (${originAirport} → ${destAirport})`
                  : `Check live prices (${originAirport} → ${destAirport})`}
              </span>
              {priceData && !loadingPrices && (
                showPrices ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {showPrices && priceData && (
              <div className="mt-2 space-y-1.5">
                {priceData.error && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    ⚠ {priceData.error}
                  </p>
                )}
                {priceData.priceLevel && (
                  <p className="text-xs text-gray-500 px-1">
                    Price level: <span className="font-medium">{priceData.priceLevel}</span>
                  </p>
                )}
                {priceData.flights.slice(0, 4).map((f, i) => (
                  <div
                    key={i}
                    className={`text-xs rounded-xl px-3 py-2 border ${
                      f.isBest ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800">{f.airline}</span>
                      <span className="font-bold text-gray-900">
                        {currency} {f.price > 0 ? f.price.toLocaleString() : "—"}
                      </span>
                    </div>
                    <div className="text-gray-500 mt-0.5">
                      {f.departureTime && f.arrivalTime
                        ? `${f.departureTime} → ${f.arrivalTime} · `
                        : ""}
                      {f.duration}
                      {typeof f.stops === "number" && (
                        <span className="ml-1.5">
                          · {f.stops === 0 ? "nonstop" : `${f.stops} stop${f.stops > 1 ? "s" : ""}`}
                        </span>
                      )}
                      {f.isBest && (
                        <span className="ml-1.5 text-emerald-600 font-medium">★ Best</span>
                      )}
                    </div>
                  </div>
                ))}
                {priceData.flights.length === 0 && !priceData.error && (
                  <p className="text-xs text-gray-500 px-1">No flights found for these dates.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(destination.id);
            }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isSelected
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {isSelected ? "✓ Selected" : "Select"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onGenerateItinerary(destination);
            }}
            className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-all"
          >
            📋 Plan Itinerary
          </button>
        </div>
      </div>
    </div>
  );
}
