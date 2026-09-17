"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/lib/format";
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
        {isLoading && <p className="text-muted-foreground text-sm">Memuat...</p>}
        {error && (
          <p className="text-destructive text-sm">
            Gagal memuat: {(error as Error).message}
          </p>
        )}
        {data && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-muted-foreground text-xs">Pemasukan</p>
              <p className="font-medium text-green-600">
                {formatRupiah(data.income)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Pengeluaran</p>
              <p className="font-medium text-red-600">
                {formatRupiah(data.expense)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Selisih</p>
              <p className={`font-medium ${net >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatRupiah(net)}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
