"use client";

import { Destination } from "@/lib/types";
import { Globe, Clock, TrendingUp, Star, CheckCircle } from "lucide-react";

interface DestinationCardProps {
  destination: Destination;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onGenerateItinerary: (destination: Destination) => void;
  rank: number;
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
}: DestinationCardProps) {
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
