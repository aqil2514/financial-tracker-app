"use client";

import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";

import { Card, CardContent } from "@/components/ui/card";
import { QueryState } from "@/components/query-state";
import { formatCurrency } from "@/lib/format-currency";
import { formatForexUnit, formatRate } from "@/shared/forex/forex-format";
import { UpdateForexRateDialog } from "@/shared/forex/update-rate/update-forex-rate-dialog";
import { useForexAccount } from "@/shared/forex/use-forex-account";
import { useForexHoldingSummary } from "@/shared/forex/use-forex-queries";

// Nilai terkini = unit × kurs, Unrealized P/L = nilai terkini − modal (accounts.balance).
// Modal tetap dari saldo akun, tidak terpengaruh update kurs. Persentase P/L berbasis posisi aktif.
export function ForexStats({ accountId, balance }: { accountId: string; balance: number }) {
  const { data: forexAccount, isLoading, error } = useForexAccount(accountId);
  const { data: holding } = useForexHoldingSummary(accountId);

  if (isLoading || error) {
    return (
      <Card>
        <CardContent>
          <QueryState isLoading={isLoading} error={error} />
        </CardContent>
      </Card>
    );
  }
  if (!forexAccount) return null;

  const unit = holding?.remainingUnit ?? 0;
  const averageCost = holding?.averageCostPerUnit ?? 0;
  const rate = forexAccount.current_rate;
  const hasRate = rate > 0;
  const value = unit * rate;
  const pl = value - balance;
  const plPercent = balance !== 0 ? (pl / balance) * 100 : 0;
  const plColor = pl >= 0 ? "text-green-600" : "text-red-600";

  // updated_at dari SQLite datetime('now') bernilai UTC, "Z" wajib supaya selisih ke sekarang benar.
  const updatedAgo = formatDistanceToNow(new Date(`${forexAccount.updated_at.replace(" ", "T")}Z`), {
    addSuffix: true,
    locale: id,
  });

  return (
    <Card>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <div className="flex h-5 items-center">
              <p className="text-muted-foreground text-xs">Jumlah Dipegang</p>
            </div>
            <p className="font-medium">{formatForexUnit(unit, forexAccount.currency)}</p>
          </div>
          <div>
            <div className="flex h-5 items-center gap-1">
              <p className="text-muted-foreground text-xs">Kurs Terkini</p>
              <UpdateForexRateDialog accountId={accountId} currentRate={rate} />
            </div>
            <p className="font-medium">{hasRate ? formatRate(rate) : "Belum diisi"}</p>
          </div>
          <div>
            <div className="flex h-5 items-center">
              <p className="text-muted-foreground text-xs">Average Cost / {forexAccount.currency}</p>
            </div>
            <p className="font-medium">{averageCost > 0 ? formatRate(averageCost) : "—"}</p>
          </div>
          <div>
            <div className="flex h-5 items-center gap-1">
              <p className="text-muted-foreground text-xs">Nilai Terkini</p>
              <UpdateForexRateDialog accountId={accountId} currentRate={rate} />
            </div>
            <p className="font-medium">{hasRate ? formatCurrency(value, "IDR") : "—"}</p>
          </div>
          <div>
            <div className="flex h-5 items-center">
              <p className="text-muted-foreground text-xs">Unrealized P/L</p>
            </div>
            <p className={`font-medium ${hasRate ? plColor : ""}`}>
              {hasRate ? `${pl >= 0 ? "+" : ""}${formatCurrency(pl, "IDR")}` : "—"}
            </p>
          </div>
          <div>
            <div className="flex h-5 items-center">
              <p className="text-muted-foreground text-xs">P/L (% posisi aktif)</p>
            </div>
            <p className={`font-medium ${hasRate ? plColor : ""}`}>
              {hasRate ? `${pl >= 0 ? "+" : ""}${plPercent.toFixed(2)}%` : "—"}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-3">
            <div className="flex h-5 items-center">
              <p className="text-muted-foreground text-xs">Kurs Diupdate</p>
            </div>
            <p className="font-medium first-letter:uppercase">{updatedAgo}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
