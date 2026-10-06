"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useInvestmentDetailPage } from "../page/investment-detail-page-context";
import { SettlementBreakdown } from "./settlement-breakdown";
import { PurchaseHistoryTable } from "./purchase-history-table";

/** Nilai pasar terkini & Unrealized P/L ada di header (lihat
 * `features/investment-detail/header/investment-pl-stats.tsx`). Di sini:
 * breakdown pending/settled + riwayat pembelian per lot. Average cost per
 * unit & indikator staleness menyusul, lihat
 * docs/todos/plan/account-type-investment.md langkah 4. */
export function InvestmentDetailContent() {
  const { account, isLoading } = useInvestmentDetailPage();

  if (isLoading) return null;
  if (!account) return null;

  return (
    <div className="space-y-4">
      <SettlementBreakdown accountId={account.id} />
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Pembelian</CardTitle>
        </CardHeader>
        <CardContent>
          <PurchaseHistoryTable accountId={account.id} />
        </CardContent>
      </Card>
    </div>
  );
}
