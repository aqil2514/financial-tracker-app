"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useForexDetailPage } from "../page/forex-detail-page-context";
import { PurchaseHistoryTable } from "./purchase-history-table";
import { SalesHistoryTable } from "./sales-history-table";

// Kurs terkini dan Unrealized P/L ada di header (forex-stats.tsx). Di sini: riwayat beli dan jual.
export function ForexDetailContent() {
  const { account, isLoading } = useForexDetailPage();

  if (isLoading || !account) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Pembelian</CardTitle>
        </CardHeader>
        <CardContent>
          <PurchaseHistoryTable accountId={account.id} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Penjualan</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesHistoryTable accountId={account.id} />
        </CardContent>
      </Card>
    </div>
  );
}
