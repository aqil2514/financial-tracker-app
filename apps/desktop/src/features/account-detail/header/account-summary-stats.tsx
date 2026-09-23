"use client";

import { QueryState } from "@/components/query-state";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format-currency";
import { useAccountSummary } from "./use-account-summary";

/** Ringkasan uang masuk/keluar/total (seluruh riwayat akun ini) + saldo
 * saat ini — pola stat grid sama seperti `SummaryStats` di dashboard
 * (`features/dashboard/content/current-month-summary/summary-stats.tsx`),
 * ditambah satu kolom saldo. */
export function AccountSummaryStats({
  accountId,
  balance,
}: {
  accountId: number;
  balance: number;
}) {
  const { data, isLoading, error } = useAccountSummary(accountId);
  const net = (data?.income ?? 0) - (data?.expense ?? 0);

  return (
    <Card>
      <CardContent>
        <QueryState isLoading={isLoading} error={error} />
        {data && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-xs">Masuk</p>
              <p className="font-medium text-green-600">{formatCurrency(data.income, "IDR")}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Keluar</p>
              <p className="font-medium text-red-600">{formatCurrency(data.expense, "IDR")}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Total</p>
              <p className={`font-medium ${net >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(net, "IDR")}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Saldo Saat Ini</p>
              <p className="font-medium">{formatCurrency(balance, "IDR")}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
