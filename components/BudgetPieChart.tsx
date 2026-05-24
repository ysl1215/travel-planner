"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Props {
  pieData: { name: string; value: number }[];
  colors: string[];
  currency: string;
}

export default function BudgetPieChart({ pieData, colors, currency }: Props) {
  return (
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
  );
}
