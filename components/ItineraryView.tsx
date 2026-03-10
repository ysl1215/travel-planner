"use client";

import { useState } from "react";
import { TripItinerary, ItineraryDay } from "@/lib/types";
import {
  Sun, CloudSun, Moon, MapPin, Clock, DollarSign, Lightbulb,
  UtensilsCrossed, Star, Footprints, Route, Info
} from "lucide-react";

interface ItineraryViewProps {
  itinerary: TripItinerary;
}

const typeIcons: Record<string, React.ReactNode> = {
  attraction: <Star className="w-4 h-4 text-amber-500" />,
  food: <UtensilsCrossed className="w-4 h-4 text-rose-500" />,
  transport: <Route className="w-4 h-4 text-blue-500" />,
  accommodation: <MapPin className="w-4 h-4 text-violet-500" />,
  activity: <Footprints className="w-4 h-4 text-emerald-500" />,
};

function ActivityItem({
  time,
  activity,
  location,
  duration,
  cost,
  tips,
  type,
}: {
  time: string;
  activity: string;
  location: string;
  duration: string;
  cost: string;
  tips?: string;
  type: string;
}) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-16 flex-shrink-0 text-xs text-gray-400 pt-0.5">{time}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          {typeIcons[type] ?? <Info className="w-4 h-4 text-gray-400" />}
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">{activity}</div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500">
              <span className="flex items-center gap-0.5">
                <MapPin className="w-3 h-3" /> {location}
              </span>
              <span className="flex items-center gap-0.5">
                <Clock className="w-3 h-3" /> {duration}
              </span>
              <span className="flex items-center gap-0.5">
                <DollarSign className="w-3 h-3" /> {cost}
              </span>
            </div>
            {tips && (
              <div className="flex items-start gap-1 mt-1 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{tips}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayCard({ day }: { day: ItineraryDay }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 bg-gradient-to-r from-slate-700 to-slate-800 text-white flex items-center justify-between"
      >
        <div>
          <div className="text-sm text-gray-400">Day {day.day}</div>
          <div className="font-bold text-lg">{day.theme}</div>
          <div className="text-sm text-gray-300 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3" /> {day.location}
          </div>
        </div>
        <span className="text-2xl">{expanded ? "−" : "+"}</span>
      </button>

      {expanded && (
        <div className="p-5 space-y-5">
          {/* Morning */}
          {day.morning.length > 0 && (
            <div>
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-amber-600 mb-2">
                <Sun className="w-4 h-4" /> Morning
              </h4>
              {day.morning.map((a, i) => (
                <ActivityItem key={i} {...a} />
              ))}
            </div>
          )}

          {/* Afternoon */}
          {day.afternoon.length > 0 && (
            <div>
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-orange-500 mb-2">
                <CloudSun className="w-4 h-4" /> Afternoon
              </h4>
              {day.afternoon.map((a, i) => (
                <ActivityItem key={i} {...a} />
              ))}
            </div>
          )}

          {/* Evening */}
          {day.evening.length > 0 && (
            <div>
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-indigo-500 mb-2">
                <Moon className="w-4 h-4" /> Evening
              </h4>
              {day.evening.map((a, i) => (
                <ActivityItem key={i} {...a} />
              ))}
            </div>
          )}

          {day.travelNote && (
            <div className="text-xs bg-blue-50 text-blue-700 rounded-lg px-3 py-2 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              {day.travelNote}
            </div>
          )}

          {day.accommodation && (
            <div className="text-xs bg-violet-50 text-violet-700 rounded-lg px-3 py-2 flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span><strong>Stay:</strong> {day.accommodation}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ItineraryView({ itinerary }: ItineraryViewProps) {
  const [activeTab, setActiveTab] = useState<"itinerary" | "attractions" | "food" | "tips">(
    "itinerary"
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl p-6 text-white">
        <h2 className="text-2xl font-bold">{itinerary.destination}</h2>
        <p className="text-blue-100 mt-1">{itinerary.totalDays} days · {itinerary.overview}</p>
        <p className="text-sm text-blue-200 mt-2">🗓️ Best time: {itinerary.bestTimeToVisit}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
        {(["itinerary", "attractions", "food", "tips"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all capitalize ${
              activeTab === tab
                ? "bg-white shadow-sm text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "itinerary" && "📅 "}
            {tab === "attractions" && "🎯 "}
            {tab === "food" && "🍽️ "}
            {tab === "tips" && "💡 "}
            {tab}
          </button>
        ))}
      </div>

      {/* Day-by-Day Itinerary */}
      {activeTab === "itinerary" && (
        <div className="space-y-4">
          {itinerary.days.map((day) => (
            <DayCard key={day.day} day={day} />
          ))}

          {/* Route */}
          {itinerary.route.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Route className="w-4 h-4 text-blue-500" /> Optimal Route
              </h3>
              <div className="space-y-3">
                {itinerary.route.map((seg, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1 text-sm text-gray-700">
                      <span className="font-medium">{seg.from}</span>
                      <span className="text-gray-400 mx-2">→</span>
                      <span className="font-medium">{seg.to}</span>
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <span>{seg.mode}</span>
                      <span>·</span>
                      <span>{seg.duration}</span>
                      <span>·</span>
                      <span className="text-emerald-600">{seg.cost}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top Attractions */}
      {activeTab === "attractions" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {itinerary.topAttractions.map((attr, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900 text-sm">{attr.name}</h3>
                <div className="flex items-center gap-1">
                  {attr.offBeatenPath && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      Hidden gem
                    </span>
                  )}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      attr.cost === "free"
                        ? "bg-green-100 text-green-700"
                        : attr.cost === "cheap"
                        ? "bg-emerald-100 text-emerald-700"
                        : attr.cost === "moderate"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {attr.cost}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-600 mb-2">{attr.description}</p>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-0.5">
                  <Clock className="w-3 h-3" /> {attr.estimatedDuration}
                </span>
                {attr.waitTime && (
                  <span className="flex items-center gap-0.5 text-amber-600">
                    ⏳ {attr.waitTime}
                  </span>
                )}
              </div>
              {attr.tips && (
                <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                  💡 {attr.tips}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Food Recommendations */}
      {activeTab === "food" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {itinerary.foodRecommendations.map((food, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-semibold text-gray-900 text-sm">{food.name}</h3>
                {food.touristTrap && (
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                    Tourist trap
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                  {food.cuisine}
                </span>
                <span className="text-xs text-emerald-600 font-medium">{food.priceRange}</span>
              </div>
              <p className="text-xs text-gray-600 mb-2">{food.description}</p>
              {food.mustTry.length > 0 && (
                <div>
                  <span className="text-xs text-gray-500">Must try: </span>
                  <span className="text-xs text-gray-700">{food.mustTry.join(", ")}</span>
                </div>
              )}
              <div className="flex items-center gap-0.5 text-xs text-gray-400 mt-1">
                <MapPin className="w-3 h-3" /> {food.location}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Practical Tips */}
      {activeTab === "tips" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
            💡 Practical Tips for {itinerary.destination}
          </h3>
          <ul className="space-y-3">
            {itinerary.practicalTips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold text-sm">✓</span>
                <p className="text-sm text-gray-700">{tip}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
