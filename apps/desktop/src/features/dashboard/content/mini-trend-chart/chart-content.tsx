"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { useMonthlySummary } from "@/features/reports";
import { ChartTooltip } from "./chart-tooltip";

const MONTHS = 6;

export function ChartContent() {
  const { data } = useMonthlySummary(MONTHS);

  if (!data) return null;

  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">Belum ada data.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="income" fill="#16a34a" radius={4} />
        <Bar dataKey="expense" fill="#dc2626" radius={4} />
      </BarChart>
    </ResponsiveContainer>
  );
}
