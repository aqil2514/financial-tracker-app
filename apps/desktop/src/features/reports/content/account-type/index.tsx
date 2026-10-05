"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryState } from "@/components/query-state";
import { formatCurrency } from "@/lib/format-currency";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/account-types";
import { useBalancesByAccountType } from "./use-balances-by-account-type";

const COLORS = ["#2563eb", "#f97316", "#22c55e", "#eab308", "#a855f7", "#ec4899"];

function accountTypeLabel(accountType: string) {
  return ACCOUNT_TYPE_OPTIONS.find((option) => option.value === accountType)?.label ?? accountType;
}

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

export function AccountTypeSection() {
  const { data, isLoading, error } = useBalancesByAccountType();

  const total = useMemo(
    () => data?.reduce((sum, row) => sum + row.total, 0) ?? 0,
    [data]
  );

  const chartData = useMemo(() => {
    if (!data) return undefined;
    return data.map((row, index) => ({
      ...row,
      label: accountTypeLabel(row.account_type),
      percent: total > 0 ? (row.total / total) * 100 : 0,
      color: COLORS[index % COLORS.length],
    }));
  }, [data, total]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Per Tipe Akun</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <QueryState isLoading={isLoading} error={error} />
        {chartData && chartData.length === 0 && (
          <p className="text-muted-foreground text-sm">Belum ada akun.</p>
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
                      <Cell key={row.account_type} fill={row.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {chartData.map((row) => (
                <Card key={row.account_type}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm font-normal">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: row.color }}
                      />
                      <span className="text-muted-foreground">{row.label}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{formatCurrency(row.total, "IDR")}</p>
                    <p className="text-muted-foreground text-sm">
                      {row.percent.toFixed(0)}% dari total
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
