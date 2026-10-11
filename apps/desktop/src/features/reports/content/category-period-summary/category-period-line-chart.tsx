"use client";

import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { QueryState } from "@/components/query-state";
import { formatCompactNotation } from "@/lib/format";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { useCategoryPeriodTransactions } from "./use-category-period-transactions";

const COLORS = { income: "#22c55e", expense: "#ef4444" };

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-popover rounded-lg border p-3 text-sm shadow-md">
      {payload.map((row) => (
        <p key={row.name} style={{ color: row.color }}>
          {row.name}: {formatCurrency(row.value, "IDR")}
        </p>
      ))}
    </div>
  );
}

export function CategoryPeriodLineChart({ periodId }: { periodId: string }) {
  const { data: transactions, isLoading, error } = useCategoryPeriodTransactions(periodId);

  const chartData = useMemo(() => {
    if (!transactions) return undefined;
    const byDate = new Map<string, { income: number; expense: number }>();
    for (const tx of transactions) {
      const dateOnly = tx.date.slice(0, 10);
      const entry = byDate.get(dateOnly) ?? { income: 0, expense: 0 };
      if (tx.type === "income") entry.income += tx.amount;
      else if (tx.type === "expense") entry.expense += tx.amount;
      byDate.set(dateOnly, entry);
    }
    return Array.from(byDate.entries())
      .map(([date, totals]) => ({ date, displayDate: formatDate(date, "date-only"), ...totals }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions]);

  return (
    <div className="space-y-2">
      <QueryState isLoading={isLoading} error={error} />

      {chartData && chartData.length === 0 && (
        <p className="text-muted-foreground text-sm">Belum ada transaksi pada periode ini.</p>
      )}

      {chartData && chartData.length > 0 && (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="displayDate" fontSize={11} tickMargin={6} />
              <YAxis fontSize={11} tickFormatter={(value: number) => formatCompactNotation(value)} width={48} />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              <Line type="monotone" dataKey="income" name="Pemasukan" stroke={COLORS.income} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="expense" name="Pengeluaran" stroke={COLORS.expense} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
