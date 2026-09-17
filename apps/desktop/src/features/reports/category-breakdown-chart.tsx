"use client";

import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { QueryState } from "@/components/query-state";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatCurrency } from "@/lib/format-currency";
import { useCategoryBreakdown } from "./use-category-breakdown";

const RANGE_OPTIONS = [
  { value: "1", label: "Bulan ini" },
  { value: "3", label: "3 bulan terakhir" },
  { value: "6", label: "6 bulan terakhir" },
  { value: "12", label: "12 bulan terakhir" },
];

const TOP_N = 6;
const OTHERS_LABEL = "Lainnya";
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
  payload?: { payload: { name: string; total: number; percent: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="bg-popover rounded-lg border p-3 text-sm shadow-md">
      <p className="font-medium">{row.name}</p>
      <p className="text-muted-foreground">
        {formatCurrency(row.total, "IDR")} ({row.percent.toFixed(1)}%)
      </p>
    </div>
  );
}

export function CategoryBreakdownChart() {
  const [months, setMonths] = useState(3);
  const [type, setType] = useState<"income" | "expense">("expense");
  const { data, isLoading, error } = useCategoryBreakdown(months, type);

  const total = useMemo(
    () => data?.reduce((sum, row) => sum + row.total, 0) ?? 0,
    [data]
  );

  const chartData = useMemo(() => {
    if (!data) return undefined;

    const top = data.slice(0, TOP_N);
    const rest = data.slice(TOP_N);
    const restTotal = rest.reduce((sum, row) => sum + row.total, 0);

    const rows = restTotal > 0 ? [...top, { name: OTHERS_LABEL, total: restTotal }] : top;

    return rows.map((row, index) => ({
      ...row,
      percent: total > 0 ? (row.total / total) * 100 : 0,
      color: COLORS[index % COLORS.length],
    }));
  }, [data, total]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Breakdown per Kategori</CardTitle>
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
      <CardContent className="space-y-4">
        <ToggleGroup
          value={[type]}
          onValueChange={(values: string[]) => {
            if (values.length > 0) {
              setType(values[values.length - 1] as "income" | "expense");
            }
          }}
          className="w-full"
        >
          <ToggleGroupItem value="expense" className="flex-1">
            Pengeluaran
          </ToggleGroupItem>
          <ToggleGroupItem value="income" className="flex-1">
            Pemasukan
          </ToggleGroupItem>
        </ToggleGroup>

        <QueryState isLoading={isLoading} error={error} />
        {chartData && chartData.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Belum ada data pada periode ini.
          </p>
        )}

        {chartData && chartData.length > 0 && (
          <>
            <div className="flex items-center justify-between px-1">
              <span className="text-muted-foreground text-sm">
                {type === "expense" ? "Pengeluaran" : "Pemasukan"}
              </span>
              <span className="font-semibold">{formatCurrency(total, "IDR")}</span>
            </div>

            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="total"
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
                    {formatCurrency(row.total, "IDR")}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
