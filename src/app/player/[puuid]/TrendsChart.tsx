"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const LINE_COLOR = "#2a78d6";

export interface TrendPoint {
  label: string;
  csPerMin: number;
}

export default function TrendsChart({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) {
    return <p style={{ color: "#999", fontSize: 13 }}>Trend göstermek için en az 2 senkronize maç gerekiyor.</p>;
  }

  return (
    <div style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#888" }} axisLine={{ stroke: "#ddd" }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            formatter={(value) => [Number(value).toFixed(1), "CS/min"]}
            contentStyle={{ fontSize: 12, borderRadius: 6 }}
          />
          <Line type="monotone" dataKey="csPerMin" stroke={LINE_COLOR} strokeWidth={2} dot={{ r: 3 }} name="CS/min" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
