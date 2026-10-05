"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { QueryState } from "@/components/query-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/format-currency";
import { useCashflowBreakdown, type CashflowGroupBy } from "./use-cashflow-breakdown";

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
  payload?: { payload: { label: string; total: number; percent: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="bg-popover rounded-lg border p-3 text-sm shadow-md">
      <p className="font-medium">{row.label}</p>
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
  groupBy,
  onRowClick,
}: {
  title: string;
  type: "income" | "expense";
  from: string;
  to: string;
  groupBy: CashflowGroupBy;
  onRowClick: (row: { groupKey: string | null; label: string }) => void;
}) {
  const { data, isLoading, error } = useCashflowBreakdown(from, to, type, groupBy);

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
                  nameKey="label"
                  innerRadius="55%"
                  outerRadius="90%"
                  paddingAngle={2}
                >
                  {chartData.map((row) => (
                    <Cell key={row.label} fill={row.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ScrollArea className="h-64">
            <ul className="divide-y pr-3">
              {chartData.map((row) => (
                <li key={row.label}>
                  <button
                    type="button"
                    onClick={() => onRowClick({ groupKey: row.group_key, label: row.label })}
                    className="hover:bg-muted/50 flex w-full items-center justify-between gap-3 rounded-md px-1 py-2 text-left text-sm transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: row.color }}
                      >
                        {row.percent.toFixed(0)}%
                      </span>
                      <span>{row.label}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {formatCurrency(row.total, "IDR")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
