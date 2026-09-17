"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRupiah } from "@/lib/format";
import { useMonthlySummary } from "./use-monthly-summary";

const RANGE_OPTIONS = [
  { value: "6", label: "6 bulan terakhir" },
  { value: "12", label: "12 bulan terakhir" },
  { value: "24", label: "24 bulan terakhir" },
  { value: "36", label: "36 bulan terakhir" },
];

function formatMonthLabel(month: string) {
  const [year, monthNum] = month.split("-");
  const date = new Date(Number(year), Number(monthNum) - 1);
  return new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "2-digit",
  }).format(date);
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const income = payload.find((p) => p.dataKey === "income")?.value ?? 0;
  const expense = payload.find((p) => p.dataKey === "expense")?.value ?? 0;

  return (
    <div className="bg-popover rounded-lg border p-3 text-sm shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      <p className="text-green-600">Pemasukan: {formatRupiah(income)}</p>
      <p className="text-red-600">Pengeluaran: {formatRupiah(expense)}</p>
      <p className="text-muted-foreground mt-1 border-t pt-1">
        Selisih: {formatRupiah(income - expense)}
      </p>
    </div>
  );
}

export function MonthlySummaryChart() {
  const [months, setMonths] = useState(12);
  const { data, isLoading, error } = useMonthlySummary(months);

  const chartData = data?.map((row) => ({
    ...row,
    label: formatMonthLabel(row.month),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ringkasan Bulanan</CardTitle>
        <CardAction>
          <Select
            value={String(months)}
            onValueChange={(value) => setMonths(Number(value))}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="h-80">
        {isLoading && (
          <p className="text-muted-foreground text-sm">Memuat...</p>
        )}
        {error && (
          <p className="text-destructive text-sm">
            Gagal memuat: {(error as Error).message}
          </p>
        )}
        {chartData && chartData.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Belum ada data transaksi pada periode ini.
          </p>
        )}
        {chartData && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis
                tickFormatter={(value) =>
                  new Intl.NumberFormat("id-ID", {
                    notation: "compact",
                    compactDisplay: "short",
                  }).format(value)
                }
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="income" fill="#16a34a" radius={4} name="Pemasukan" />
              <Bar dataKey="expense" fill="#dc2626" radius={4} name="Pengeluaran" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
