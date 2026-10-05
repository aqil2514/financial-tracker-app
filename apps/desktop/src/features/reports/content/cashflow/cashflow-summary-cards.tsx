"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryState } from "@/components/query-state";
import { formatCurrency } from "@/lib/format-currency";
import { useCashflowSummary } from "./use-cashflow-summary";

export function CashflowSummaryCards({ from, to }: { from: string; to: string }) {
  const { data, isLoading, error } = useCashflowSummary(from, to);

  if (isLoading || error) {
    return <QueryState isLoading={isLoading} error={error} />;
  }

  if (!data) return null;

  const net = data.income - data.expense;
  const isSurplus = net >= 0;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground text-sm font-normal">
            Pemasukan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold text-green-600">
            {formatCurrency(data.income, "IDR")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground text-sm font-normal">
            Pengeluaran
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold text-red-600">
            {formatCurrency(data.expense, "IDR")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground text-sm font-normal">
            {isSurplus ? "Surplus" : "Defisit"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={`text-2xl font-semibold ${isSurplus ? "text-green-600" : "text-red-600"}`}
          >
            {isSurplus ? "+" : "-"}
            {formatCurrency(Math.abs(net), "IDR")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
