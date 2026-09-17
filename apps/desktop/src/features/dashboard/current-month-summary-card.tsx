"use client";

import { QueryState } from "@/components/query-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format-currency";
import { useCurrentMonthSummary } from "./use-current-month-summary";

export function CurrentMonthSummaryCard() {
  const { data, isLoading, error } = useCurrentMonthSummary();
  const net = (data?.income ?? 0) - (data?.expense ?? 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulan Ini</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryState isLoading={isLoading} error={error} />
        {data && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-muted-foreground text-xs">Pemasukan</p>
              <p className="font-medium text-green-600">
                {formatCurrency(data.income, "IDR")}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Pengeluaran</p>
              <p className="font-medium text-red-600">
                {formatCurrency(data.expense, "IDR")}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Selisih</p>
              <p className={`font-medium ${net >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(net, "IDR")}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
