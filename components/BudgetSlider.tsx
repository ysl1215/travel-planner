"use client";

import { useState } from "react";
import { BudgetSplit } from "@/lib/types";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface BudgetSliderProps {
  totalBudget: number;
  currency: string;
  split: BudgetSplit;
  onChange: (split: BudgetSplit) => void;
}

const COLORS = {
  travel: "#3B82F6",
  accommodation: "#10B981",
  food: "#F59E0B",
  activities: "#8B5CF6",
  misc: "#6B7280",
};

const LABELS = {
  travel: "✈️ Travel",
  accommodation: "🏨 Accommodation",
  food: "🍜 Food",
  activities: "🎭 Activities",
  misc: "💳 Misc",
};

export default function BudgetSlider({
  totalBudget,
  currency,
  split,
  onChange,
}: BudgetSliderProps) {
  const categories = Object.keys(split) as (keyof BudgetSplit)[];

  const updateCategory = (category: keyof BudgetSplit, newValue: number) => {
    const oldValue = split[category];
    const diff = newValue - oldValue;
    const others = categories.filter((c) => c !== category);
    const totalOthers = others.reduce((sum, c) => sum + split[c], 0);

    if (totalOthers === 0) return;

    const newSplit = { ...split };
    newSplit[category] = newValue;

    // Distribute the diff proportionally among others
    others.forEach((c) => {
      const proportion = split[c] / totalOthers;
      const adjustment = -diff * proportion;
      newSplit[c] = Math.max(0, Math.round(split[c] + adjustment));
    });

    // Fix rounding errors
    const total = Object.values(newSplit).reduce((s, v) => s + v, 0);
    const roundingError = totalBudget - total;
    const lastCategory = others[others.length - 1];
    newSplit[lastCategory] = Math.max(0, newSplit[lastCategory] + roundingError);

    onChange(newSplit);
  };

  const pieData = categories.map((cat) => ({
    name: LABELS[cat],
    value: split[cat],
  }));

  const colors = categories.map((cat) => COLORS[cat]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Budget Allocation</h2>
      <p className="text-sm text-gray-500 mb-5">
        Drag the sliders to adjust how you&apos;d like to split your{" "}
        <strong>
          {totalBudget.toLocaleString()} {currency}
        </strong>{" "}
        budget
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sliders */}
        <div className="space-y-4">
          {categories.map((cat) => {
            const percentage = Math.round((split[cat] / totalBudget) * 100);
            return (
              <div key={cat}>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-gray-700">
                    {LABELS[cat]}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{percentage}%</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {split[cat].toLocaleString()} {currency}
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={totalBudget}
                  step={10}
                  value={split[cat]}
                  onChange={(e) => updateCategory(cat, Number(e.target.value))}
                  style={{ accentColor: COLORS[cat] }}
                  className="w-full"
                />
                <div
                  className="h-1.5 rounded-full mt-1"
                  style={{
                    background: `linear-gradient(to right, ${COLORS[cat]} ${percentage}%, #e5e7eb ${percentage}%)`,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Pie Chart */}
        <div className="h-64 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) =>
                  [`${Number(value).toLocaleString()} ${currency}`, ""]
                }
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Row */}
      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-5 gap-3">
        {categories.map((cat) => (
          <div key={cat} className="text-center">
            <div className="text-xs text-gray-500">{LABELS[cat]}</div>
            <div className="text-sm font-bold" style={{ color: COLORS[cat] }}>
              {split[cat].toLocaleString()} {currency}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
