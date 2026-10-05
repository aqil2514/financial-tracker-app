"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { QueryState } from "@/components/query-state";
import { formatCompactNotation } from "@/lib/format";
import { formatCurrency } from "@/lib/format-currency";
import type { BalanceTrendPoint, Granularity } from "./use-balance-trend";

function formatPointLabel(label: string, granularity: Granularity) {
  if (granularity === "day") {
    return new Date(`${label}T00:00`).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
    });
  }
  if (granularity === "month") {
    const [year, month] = label.split("-");
    return new Date(Number(year), Number(month) - 1).toLocaleDateString("id-ID", {
      month: "short",
      year: "2-digit",
    });
  }
  if (granularity === "year") return label;

  const [year, week] = label.split("-");
  return `M${Number(week)} '${year.slice(2)}`;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { label: string; balance: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="bg-popover rounded-lg border p-3 text-sm shadow-md">
      <p className="font-medium">{row.label}</p>
      <p className="text-muted-foreground">{formatCurrency(row.balance, "IDR")}</p>
    </div>
  );
}

export function BalanceTrendChart({
  data,
  isLoading,
  error,
  granularity,
}: {
  data: BalanceTrendPoint[] | undefined;
  isLoading: boolean;
  error: unknown;
  granularity: Granularity;
}) {
  const chartData = data?.map((point) => ({
    ...point,
    displayLabel: formatPointLabel(point.label, granularity),
  }));

  return (
    <div className="space-y-4">
      <QueryState isLoading={isLoading} error={error} />
      {chartData && chartData.length === 0 && (
        <p className="text-muted-foreground text-sm">Belum ada data pada periode ini.</p>
      )}

      {chartData && chartData.length > 0 && (
        <>
          {(() => {
            const first = chartData[0];
            const last = chartData[chartData.length - 1];
            const change = last.balance - first.balance;
            const isUp = change >= 0;

            return (
              <div className="flex items-center justify-between px-1">
                <span className="text-muted-foreground text-sm">
                  {formatCurrency(first.balance, "IDR")} → {formatCurrency(last.balance, "IDR")}
                </span>
                <span className={`font-semibold ${isUp ? "text-green-600" : "text-red-600"}`}>
                  {isUp ? "+" : ""}
                  {formatCurrency(change, "IDR")}
                </span>
              </div>
            );
          })()}

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="balanceTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="displayLabel" fontSize={12} tickMargin={8} />
                <YAxis
                  fontSize={12}
                  tickFormatter={(value: number) => formatCompactNotation(value)}
                  width={56}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fill="url(#balanceTrendFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
