"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { QueryState } from "@/components/query-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/format-currency";
import { useAccountBalances } from "@/features/reports";
import { useAccountGroupBalances } from "./use-account-group-balances";

const TOP_N = 5;
const COLORS = ["#2563eb", "#22c55e", "#f97316", "#eab308", "#a855f7"];

interface BalanceRow {
  name: string;
  balance: number;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { name: string; balance: number; percent: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="bg-popover rounded-lg border p-3 text-sm shadow-md">
      <p className="font-medium">{row.name}</p>
      <p className="text-muted-foreground">
        {formatCurrency(row.balance, "IDR")} ({row.percent.toFixed(1)}%)
      </p>
    </div>
  );
}

function BalancePie({
  data,
  isLoading,
  error,
  emptyMessage,
}: {
  data: BalanceRow[] | undefined;
  isLoading: boolean;
  error: Error | null;
  emptyMessage: string;
}) {
  const chartData = useMemo(() => {
    if (!data) return undefined;

    const top = data.slice(0, TOP_N);
    const total = top.reduce((sum, row) => sum + row.balance, 0);

    return top.map((row, index) => ({
      ...row,
      percent: total > 0 ? (row.balance / total) * 100 : 0,
      color: COLORS[index % COLORS.length],
    }));
  }, [data]);

  return (
    <div className="space-y-4">
      <QueryState isLoading={isLoading} error={error} />
      {chartData && chartData.length === 0 && (
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      )}

      {chartData && chartData.length > 0 && (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="balance"
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
                  {formatCurrency(row.balance, "IDR")}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function AccountBalancePieChart() {
  const accountBalances = useAccountBalances();
  const groupBalances = useAccountGroupBalances();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 5 Saldo</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="account">
          <TabsList>
            <TabsTrigger value="account">Per Akun</TabsTrigger>
            <TabsTrigger value="group">Per Grup Akun</TabsTrigger>
          </TabsList>
          <TabsContent value="account">
            <BalancePie
              data={accountBalances.data}
              isLoading={accountBalances.isLoading}
              error={accountBalances.error as Error | null}
              emptyMessage="Belum ada akun."
            />
          </TabsContent>
          <TabsContent value="group">
            <BalancePie
              data={groupBalances.data}
              isLoading={groupBalances.isLoading}
              error={groupBalances.error as Error | null}
              emptyMessage="Belum ada grup akun."
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
