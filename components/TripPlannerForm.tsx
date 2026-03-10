"use client";

import { useState } from "react";
import { TripPlannerInput } from "@/lib/types";
import { MapPin, DollarSign, Calendar, Users, Heart, Ban, Train, Sliders } from "lucide-react";

const ACTIVITY_OPTIONS = [
  "Beach & Swimming", "Hiking & Trekking", "Cultural Sites", "Museums",
  "Food & Culinary", "Nightlife", "Shopping", "Adventure Sports",
  "Wildlife & Nature", "History", "Art & Architecture", "Wellness & Spa",
  "Photography", "Local Markets", "Water Sports", "Skiing & Snow",
];

const TRAVEL_MODES = ["Flight", "Train", "Rental Car", "Bus", "Cruise"];
const TRAVEL_STYLES = [
  "Budget Backpacker", "Mid-range Comfort", "Luxury", "Family-friendly",
  "Solo Adventure", "Romantic Getaway", "Cultural Immersion", "Off-the-beaten-path",
];
const CURRENCIES = ["USD", "EUR", "GBP", "SGD", "AUD", "CAD", "JPY"];

interface TripPlannerFormProps {
  onSubmit: (input: TripPlannerInput) => void;
  isLoading: boolean;
}

export default function TripPlannerForm({ onSubmit, isLoading }: TripPlannerFormProps) {
  const [form, setForm] = useState<TripPlannerInput>({
    budget: 3000,
    currency: "USD",
    homeCity: "",
    startDate: "",
    endDate: "",
    flexDays: 3,
    travelers: 2,
    likedActivities: [],
    dislikedActivities: [],
    travelMode: ["Flight"],
    country: "",
    maxTravelHours: undefined,
    travelStyle: "Mid-range Comfort",
  });

  const toggleActivity = (activity: string, type: "liked" | "disliked") => {
    const field = type === "liked" ? "likedActivities" : "dislikedActivities";
    const current = form[field];
    if (current.includes(activity)) {
      setForm({ ...form, [field]: current.filter((a) => a !== activity) });
    } else {
      setForm({ ...form, [field]: [...current, activity] });
    }
  };

  const toggleMode = (mode: string) => {
    const current = form.travelMode;
    if (current.includes(mode)) {
      setForm({ ...form, travelMode: current.filter((m) => m !== mode) });
    } else {
      setForm({ ...form, travelMode: [...current, mode] });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Budget & Currency */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-500" />
          Budget
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">Total Budget (travel + accommodation minimum)</label>
            <input
              type="number"
              min={100}
              value={form.budget}
              onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Currency</label>
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Travel Details */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-500" />
          Travel Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">Home City (where you travel from)</label>
            <input
              type="text"
              placeholder="e.g. London, Singapore, New York"
              value={form.homeCity}
              onChange={(e) => setForm({ ...form, homeCity: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Preferred Start Date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Preferred End Date</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Date Flexibility (±{form.flexDays} days)
            </label>
            <input
              type="range"
              min={0}
              max={14}
              value={form.flexDays}
              onChange={(e) => setForm({ ...form, flexDays: Number(e.target.value) })}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Exact dates</span>
              <span>Very flexible (±14 days)</span>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              <Users className="inline w-4 h-4 mr-1" />
              Number of Travelers
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={form.travelers}
              onChange={(e) => setForm({ ...form, travelers: Number(e.target.value) })}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
        </div>
      </div>

      {/* Activities */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Heart className="w-5 h-5 text-rose-500" />
          What do you love doing?
        </h2>
        <p className="text-sm text-gray-500 mb-3">Select all that apply</p>
        <div className="flex flex-wrap gap-2">
          {ACTIVITY_OPTIONS.map((activity) => {
            const liked = form.likedActivities.includes(activity);
            const disliked = form.dislikedActivities.includes(activity);
            return (
              <div key={activity} className="flex gap-1">
                <button
                  type="button"
                  onClick={() => toggleActivity(activity, "liked")}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    liked
                      ? "bg-rose-100 text-rose-700 border-2 border-rose-400"
                      : "bg-gray-50 text-gray-600 border-2 border-gray-200 hover:border-rose-300"
                  }`}
                >
                  {liked ? "♥ " : ""}{activity}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Ban className="w-4 h-4 text-gray-400" />
            Activities to de-prioritize
          </h3>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_OPTIONS.filter((a) => !form.likedActivities.includes(a)).map((activity) => {
              const disliked = form.dislikedActivities.includes(activity);
              return (
                <button
                  key={activity}
                  type="button"
                  onClick={() => toggleActivity(activity, "disliked")}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    disliked
                      ? "bg-gray-200 text-gray-500 line-through border-2 border-gray-400"
                      : "bg-gray-50 text-gray-600 border-2 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {activity}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Travel Mode & Style */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Train className="w-5 h-5 text-violet-500" />
          How do you like to travel?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm text-gray-600 mb-2">Preferred travel modes</label>
            <div className="flex flex-wrap gap-2">
              {TRAVEL_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => toggleMode(mode)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    form.travelMode.includes(mode)
                      ? "bg-violet-100 text-violet-700 border-2 border-violet-400"
                      : "bg-gray-50 text-gray-600 border-2 border-gray-200 hover:border-violet-300"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-2">Travel style</label>
            <select
              value={form.travelStyle}
              onChange={(e) => setForm({ ...form, travelStyle: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              {TRAVEL_STYLES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Optional Preferences */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Sliders className="w-5 h-5 text-amber-500" />
          Optional Preferences
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Preferred country/region (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Southeast Asia, Europe, Japan"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Max travel time from home (hours, optional)
            </label>
            <input
              type="number"
              min={1}
              max={24}
              placeholder="e.g. 8"
              value={form.maxTravelHours ?? ""}
              onChange={(e) =>
                setForm({ ...form, maxTravelHours: e.target.value ? Number(e.target.value) : undefined })
              }
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white font-semibold py-4 px-8 rounded-2xl text-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Finding perfect destinations...
          </span>
        ) : (
          "✈️ Find My Perfect Destinations"
        )}
      </button>
    </form>
  );
}
