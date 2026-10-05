"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatCompactNotation } from "@/lib/format";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import type { Transaction } from "@/lib/db";

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { date: string; displayDate: string; total: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="bg-popover rounded-lg border p-3 text-sm shadow-md">
      <p className="font-medium">{row.displayDate}</p>
      <p className="text-muted-foreground">{formatCurrency(row.total, "IDR")}</p>
    </div>
  );
}

export function CashflowTransactionsDailyChart({
  transactions,
  color,
}: {
  transactions: Transaction[] | undefined;
  color: string;
}) {
  const chartData = useMemo(() => {
    if (!transactions) return undefined;
    const totalsByDate = new Map<string, number>();
    for (const tx of transactions) {
      // `tx.date` bisa berupa timestamp penuh (ada bagian waktu) --
      // ambil cuma tanggalnya (YYYY-MM-DD) sebagai key grouping,
      // supaya transaksi di hari yang sama tidak kepecah jadi titik
      // terpisah gara-gara jam yang beda.
      const dateOnly = tx.date.slice(0, 10);
      totalsByDate.set(dateOnly, (totalsByDate.get(dateOnly) ?? 0) + tx.amount);
    }
    return Array.from(totalsByDate.entries())
      .map(([date, total]) => ({ date, displayDate: formatDate(date, "date-only"), total }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions]);

  if (!chartData || chartData.length === 0) {
    return (
      <p className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Belum ada data.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="displayDate" fontSize={11} tickMargin={6} />
        <YAxis fontSize={11} tickFormatter={(value: number) => formatCompactNotation(value)} width={48} />
        <Tooltip content={<ChartTooltip />} />
        <Line type="monotone" dataKey="total" stroke={color} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
