"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/lib/format";
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
        {isLoading && <p className="text-muted-foreground text-sm">Memuat...</p>}
        {error && (
          <p className="text-destructive text-sm">
            Gagal memuat: {(error as Error).message}
          </p>
        )}
        {data && (
          <p className="text-3xl font-semibold">{formatRupiah(total)}</p>
        )}
      </CardContent>
    </Card>
  );
}
