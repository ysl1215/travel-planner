"use client";

import { useState } from "react";
import { ItineraryCluster } from "@/lib/types";

interface Props {
  cluster: ItineraryCluster;
}

export default function ClusterCard({ cluster }: Props) {
  const [selected, setSelected] = useState<string>(cluster.recommendation);

  const selectedOption = cluster.options.find((o) => o.label === selected) ?? cluster.options[0];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">{cluster.cluster}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {cluster.attractions.length} attractions · how much time to spend?
          </p>
        </div>
        <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-2 py-0.5">
          Plan your visit
        </span>
      </div>

      {/* Option selector */}
      <div className="flex gap-2 mb-3">
        {cluster.options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => setSelected(opt.label)}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
              selected === opt.label
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300"
            }`}
          >
            {opt.label}
            <span className="block opacity-75">{opt.hours}h</span>
          </button>
        ))}
      </div>

      {/* Selected option detail */}
      {selectedOption && (
        <div className="space-y-2">
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1">Includes:</p>
            <div className="flex flex-wrap gap-1">
              {selectedOption.attractions.map((a, i) => (
                <span key={i} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">
                  {a}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">
            ⚖️ {selectedOption.tradeoff}
          </p>
        </div>
      )}

      {/* Recommendation note */}
      {selected === cluster.recommendation && (
        <p className="text-xs text-blue-600 mt-2 flex items-start gap-1">
          <span>★</span>
          <span>{cluster.recommendation_reason}</span>
        </p>
      )}
    </div>
  );
}
