"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/lib/format";
import { useMonthlySummary } from "@/features/reports";

const MONTHS = 6;

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { month: string; income: number; expense: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="bg-popover rounded-lg border p-3 text-sm shadow-md">
      <p className="font-medium">{row.month}</p>
      <p className="text-green-600">Pemasukan: {formatRupiah(row.income)}</p>
      <p className="text-red-600">Pengeluaran: {formatRupiah(row.expense)}</p>
    </div>
  );
}

export function MiniTrendChart() {
  const { data, isLoading, error } = useMonthlySummary(MONTHS);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tren 6 Bulan Terakhir</CardTitle>
      </CardHeader>
      <CardContent className="h-56">
        {isLoading && <p className="text-muted-foreground text-sm">Memuat...</p>}
        {error && (
          <p className="text-destructive text-sm">
            Gagal memuat: {(error as Error).message}
          </p>
        )}
        {data && data.length === 0 && (
          <p className="text-muted-foreground text-sm">Belum ada data.</p>
        )}
        {data && data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="income" fill="#16a34a" radius={4} />
              <Bar dataKey="expense" fill="#dc2626" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
