"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { QueryState } from "@/components/query-state";
import { formatCurrency } from "@/lib/format-currency";
import { useCategoryPeriodSummary } from "./use-category-period-summary";

const COLORS = { income: "#22c55e", expense: "#ef4444" };

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

export function CategoryPeriodPieChart({ periodId }: { periodId: string }) {
  const { data, isLoading, error } = useCategoryPeriodSummary(periodId);

  const chartData = useMemo(() => {
    if (!data) return undefined;
    const total = data.income + data.expense;
    return [
      { key: "income", label: "Pemasukan", total: data.income, color: COLORS.income },
      { key: "expense", label: "Pengeluaran", total: data.expense, color: COLORS.expense },
    ]
      .filter((row) => row.total > 0)
      .map((row) => ({ ...row, percent: total > 0 ? (row.total / total) * 100 : 0 }));
  }, [data]);

  return (
    <div className="space-y-2">
      <QueryState isLoading={isLoading} error={error} />

      {chartData && chartData.length === 0 && (
        <p className="text-muted-foreground text-sm">Belum ada transaksi pada periode ini.</p>
      )}

      {chartData && chartData.length > 0 && (
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
                  <Cell key={row.key} fill={row.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
