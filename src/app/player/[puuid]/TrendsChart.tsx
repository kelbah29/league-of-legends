"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const LINE_COLOR = "#3987e5";
const GRID_COLOR = "#2a2f3a";
const AXIS_TEXT_COLOR = "#6b7280";

export interface TrendPoint {
  label: string;
  csPerMin: number;
}

export default function TrendsChart({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) {
    return <p className="text-sm text-text-muted">Trend göstermek için en az 2 senkronize maç gerekiyor.</p>;
  }

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: AXIS_TEXT_COLOR }}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 11, fill: AXIS_TEXT_COLOR }} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            formatter={(value) => [Number(value).toFixed(1), "CS/min"]}
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              background: "#171a21",
              border: "1px solid #2a2f3a",
              color: "#ffffff",
            }}
            labelStyle={{ color: "#9aa0ac" }}
          />
          <Line type="monotone" dataKey="csPerMin" stroke={LINE_COLOR} strokeWidth={2} dot={{ r: 3 }} name="CS/min" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
