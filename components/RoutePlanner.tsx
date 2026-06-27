"use client";

import { useState } from "react";
import { RouteSegment } from "@/lib/types";
import { Route, Plus, X, ArrowRight, AlertTriangle } from "lucide-react";

interface RouteOrderResult {
  order: string[];
  segments: RouteSegment[];
  totalHours: number;
  unresolved: { from: string; to: string }[];
}

/**
 * Standalone multi-city route optimizer. Drives POST /api/route-order (engine:
 * lib/costMatrix.ts + lib/routeOrder.ts) to order a set of known cities into a
 * near-optimal visiting sequence. Self-contained — not wired into the suggest→itinerary flow.
 */
export default function RoutePlanner() {
  const [cities, setCities] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [endCity, setEndCity] = useState("");
  const [result, setResult] = useState<RouteOrderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const addCity = () => {
    const name = draft.trim();
    if (!name) return;
    if (cities.some((c) => c.toLowerCase() === name.toLowerCase())) {
      setDraft("");
      return;
    }
    setCities([...cities, name]);
    setDraft("");
  };

  const removeCity = (name: string) => {
    setCities(cities.filter((c) => c !== name));
    if (homeCity === name) setHomeCity("");
    if (endCity === name) setEndCity("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCity();
    }
  };

  const handleOptimize = async () => {
    if (cities.length < 2) {
      setError("Add at least 2 cities to order.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/route-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cities,
          homeCity: homeCity || undefined,
          endCity: endCity || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to order route");
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
        <Route className="w-5 h-5 text-indigo-500" />
        Multi-City Route Optimizer
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Already know your cities? Add them and we&apos;ll order them into the shortest
        travel route (estimated great-circle hours).
      </p>

      {/* City input */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="Add a city, e.g. Paris"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          type="button"
          onClick={addCity}
          className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {/* City chips */}
      {cities.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {cities.map((city) => (
            <span
              key={city}
              className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full pl-3 pr-2 py-1 text-sm font-medium"
            >
              {city}
              <button
                type="button"
                onClick={() => removeCity(city)}
                className="hover:bg-indigo-200 rounded-full p-0.5 transition-colors"
                aria-label={`Remove ${city}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Optional start/end anchors */}
      {cities.length >= 2 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Start city (optional)</label>
            <select
              value={homeCity}
              onChange={(e) => setHomeCity(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">No preference</option>
              {cities.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">End city (optional)</label>
            <select
              value={endCity}
              onChange={(e) => setEndCity(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">No preference</option>
              {cities.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleOptimize}
        disabled={isLoading || cities.length < 2}
        className="w-full bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Ordering route…
          </span>
        ) : (
          "🧭 Optimize Route"
        )}
      </button>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
          <span className="text-red-500 font-bold">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Optimal order</h3>
            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1">
              ~{result.totalHours}h total travel
            </span>
          </div>

          {/* Ordered route */}
          <div className="flex flex-wrap items-center gap-2">
            {result.order.map((city, i) => (
              <span key={`${city}-${i}`} className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 text-sm font-medium">
                  <span className="text-blue-400 mr-1.5 text-xs font-bold">{i + 1}</span>
                  {city}
                </span>
                {i < result.order.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-gray-300" />
                )}
              </span>
            ))}
          </div>

          {/* Per-leg segments */}
          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {result.segments.map((seg, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-gray-700">
                  {seg.from} <ArrowRight className="inline w-3.5 h-3.5 text-gray-300 mx-1" /> {seg.to}
                </span>
                <span className="text-gray-500">{seg.duration}</span>
              </li>
            ))}
          </ul>

          {result.unresolved.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
              <div className="font-medium text-amber-800 mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                {result.unresolved.length} leg{result.unresolved.length === 1 ? "" : "s"} used an estimated fallback
              </div>
              <ul className="list-disc list-inside text-amber-700 space-y-0.5">
                {result.unresolved.map((u, i) => (
                  <li key={i}>{u.from} → {u.to}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
