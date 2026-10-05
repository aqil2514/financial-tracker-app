"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { QueryState } from "@/components/query-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/format-currency";
import { useCashflowBreakdown } from "./use-cashflow-breakdown";

const COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#facc15",
  "#84cc16",
  "#22c55e",
  "#38bdf8",
];

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { group_name: string; total: number; percent: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="bg-popover rounded-lg border p-3 text-sm shadow-md">
      <p className="font-medium">{row.group_name}</p>
      <p className="text-muted-foreground">
        {formatCurrency(row.total, "IDR")} ({row.percent.toFixed(1)}%)
      </p>
    </div>
  );
}

export function CashflowColumn({
  title,
  type,
  from,
  to,
}: {
  title: string;
  type: "income" | "expense";
  from: string;
  to: string;
}) {
  const { data, isLoading, error } = useCashflowBreakdown(from, to, type);

  const total = useMemo(
    () => data?.reduce((sum, row) => sum + row.total, 0) ?? 0,
    [data]
  );

  const chartData = useMemo(() => {
    if (!data) return undefined;
    return data.map((row, index) => ({
      ...row,
      percent: total > 0 ? (row.total / total) * 100 : 0,
      color: COLORS[index % COLORS.length],
    }));
  }, [data, total]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <span className="text-muted-foreground text-sm">{title}</span>
        <span className="font-semibold">{formatCurrency(total, "IDR")}</span>
      </div>

      <QueryState isLoading={isLoading} error={error} />
      {chartData && chartData.length === 0 && (
        <p className="text-muted-foreground text-sm">Belum ada data pada periode ini.</p>
      )}

      {chartData && chartData.length > 0 && (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="total"
                  nameKey="group_name"
                  innerRadius="55%"
                  outerRadius="90%"
                  paddingAngle={2}
                >
                  {chartData.map((row) => (
                    <Cell key={row.group_name} fill={row.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ScrollArea className="h-64">
            <ul className="divide-y pr-3">
              {chartData.map((row) => (
                <li
                  key={row.group_name}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: row.color }}
                    >
                      {row.percent.toFixed(0)}%
                    </span>
                    <span>{row.group_name}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {formatCurrency(row.total, "IDR")}
                  </span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
