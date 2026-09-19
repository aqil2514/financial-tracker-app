"use client";

import { QueryState } from "@/components/query-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format-currency";
import { useAccountBalances } from "@/features/reports";

export function TotalBalanceCard() {
  const { data, isLoading, error } = useAccountBalances();

  const total = data?.reduce((sum, row) => sum + row.balance, 0) ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Total Saldo</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryState isLoading={isLoading} error={error} />
        {data && (
          <p className="text-3xl font-semibold">{formatCurrency(total, "IDR")}</p>
        )}
      </CardContent>
    </Card>
  );
}
