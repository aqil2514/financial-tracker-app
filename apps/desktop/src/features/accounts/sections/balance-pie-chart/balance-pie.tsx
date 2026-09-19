"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { QueryState } from "@/components/query-state";
import { formatCurrency } from "@/lib/format-currency";
import { ChartTooltip } from "./chart-tooltip";

const TOP_N = 5;
const COLORS = ["#2563eb", "#22c55e", "#f97316", "#eab308", "#a855f7"];

interface BalanceRow {
  name: string;
  balance: number;
}

export function BalancePie({
  data,
  isLoading,
  error,
  emptyMessage,
}: {
  data: BalanceRow[] | undefined;
  isLoading: boolean;
  error: Error | null;
  emptyMessage: string;
}) {
  const chartData = useMemo(() => {
    if (!data) return undefined;

    const top = data.slice(0, TOP_N);
    const total = top.reduce((sum, row) => sum + row.balance, 0);

    return top.map((row, index) => ({
      ...row,
      percent: total > 0 ? (row.balance / total) * 100 : 0,
      color: COLORS[index % COLORS.length],
    }));
  }, [data]);

  return (
    <div className="space-y-4">
      <QueryState isLoading={isLoading} error={error} />
      {chartData && chartData.length === 0 && (
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      )}

      {chartData && chartData.length > 0 && (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="balance"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="90%"
                  paddingAngle={2}
                >
                  {chartData.map((row) => (
                    <Cell key={row.name} fill={row.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="divide-y">
            {chartData.map((row) => (
              <li
                key={row.name}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: row.color }}
                  >
                    {row.percent.toFixed(0)}%
                  </span>
                  <span>{row.name}</span>
                </div>
                <span className="text-muted-foreground">
                  {formatCurrency(row.balance, "IDR")}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
