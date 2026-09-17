"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { QueryState } from "@/components/query-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/format-currency";
import { formatCompactNotation } from "@/lib/format";
import { useAccountBalances } from "./use-account-balances";

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { name: string; balance: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="bg-popover rounded-lg border p-3 text-sm shadow-md">
      <p className="font-medium">{row.name}</p>
      <p className="text-muted-foreground">{formatCurrency(row.balance, "IDR")}</p>
    </div>
  );
}

export function AccountBalanceChart() {
  const { data, isLoading, error } = useAccountBalances();

  const chartData = data?.map((row) => ({
    ...row,
    name: row.name.length > 16 ? `${row.name.slice(0, 16)}…` : row.name,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saldo per Akun</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryState isLoading={isLoading} error={error} />
        {chartData && chartData.length === 0 && (
          <p className="text-muted-foreground text-sm">Belum ada akun.</p>
        )}
        {chartData && chartData.length > 0 && (
          <ScrollArea className="h-96">
            <div style={{ height: chartData.length * 36 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tickFormatter={formatCompactNotation}
                  />
                  <YAxis type="category" dataKey="name" width={110} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="balance" fill="#2563eb" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
