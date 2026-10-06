"use client";

import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";

import { Card, CardContent } from "@/components/ui/card";
import { QueryState } from "@/components/query-state";
import { formatCurrency } from "@/lib/format-currency";
import { useInvestmentAccount } from "@/shared/investments/use-investment-account";
import { useInvestmentPurchases } from "@/shared/investments/use-investment-purchases";
import { UpdateMarketValueDialog } from "@/shared/investments/update-market-value/update-market-value-dialog";

/** Nilai pasar terkini + Unrealized P/L (nominal & persen) + average cost
 * per unit + staleness update satu akun investment -- pola stat grid sama
 * `AccountSummaryStats` (features/account-detail/header/account-summary-stats.tsx).
 *
 * Persen P/L dihitung dari `balance` (modal posisi AKTIF saat ini), BUKAN
 * total modal historis sejak awal -- jadi ini "return posisi aktif", beda
 * dari aplikasi investasi lain yang menghitung termasuk unit yang sudah
 * dijual. Lihat docs/concept/konsep-investasi.md bagian "Persentase P/L".
 *
 * `total_unit` TIDAK disimpan sebagai kolom -- selalu SUM dari
 * `investment_purchases` (lihat komentar di migrasi 0036), jadi dihitung
 * di sini dari `useInvestmentPurchases` yang sama dipakai tabel riwayat
 * (content/purchase-history-table.tsx), bukan query baru. */
export function InvestmentPlStats({ accountId, balance }: { accountId: string; balance: number }) {
  const { data: investmentAccount, isLoading, error } = useInvestmentAccount(accountId);
  const { data: purchases } = useInvestmentPurchases(accountId);

  if (isLoading || error) {
    return (
      <Card>
        <CardContent>
          <QueryState isLoading={isLoading} error={error} />
        </CardContent>
      </Card>
    );
  }

  if (!investmentAccount) return null;

  const marketValue = investmentAccount.current_market_value;
  const pl = marketValue - balance;
  const plPercent = balance !== 0 ? (pl / balance) * 100 : 0;
  const plColor = pl >= 0 ? "text-green-600" : "text-red-600";

  // Baris dengan unit NULL (order masih diproses, belum tahu unit
  // pastinya -- lihat migrasi 0038) di-skip dari SUM, bukan dianggap 0.
  const totalUnit = (purchases ?? []).reduce((sum, p) => sum + (p.unit ?? 0), 0);
  const averageCost = totalUnit !== 0 ? balance / totalUnit : null;
  // `updated_at` dari SQLite `datetime('now')` -- "YYYY-MM-DD HH:mm:ss"
  // (spasi, bukan "T"), NILAINYA UTC (SQLite datetime('now') selalu UTC).
  // BEDA dari lib/format-date.ts yang cuma menormalisasi spasi->"T" TANPA
  // suffix "Z" (aman untuk tampilan ABSOLUT, "new Date()" tetap merender
  // komponen Y-M-D H:m:s yang sama persis walau salah timezone) -- tapi
  // formatDistanceToNow MENGHITUNG SELISIH ke waktu sekarang, jadi kalau
  // string ini diperlakukan sebagai local time alih-alih UTC, selisihnya
  // meleset sebesar offset timezone user (bug nyata: WIB jadi "+7 jam"
  // palsu). "Z" WAJIB di sini, TIDAK WAJIB (dan tidak dipakai) di
  // format-date.ts.
  const updatedAgo = formatDistanceToNow(new Date(`${investmentAccount.updated_at.replace(" ", "T")}Z`), {
    addSuffix: true,
    locale: id,
  });

  return (
    <Card>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-1">
              <p className="text-muted-foreground text-xs">Nilai Pasar Terkini</p>
              <UpdateMarketValueDialog accountId={accountId} currentValue={marketValue} />
            </div>
            <p className="font-medium">{formatCurrency(marketValue, "IDR")}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Unrealized P/L</p>
            <p className={`font-medium ${plColor}`}>
              {pl >= 0 ? "+" : ""}
              {formatCurrency(pl, "IDR")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">P/L (% posisi aktif)</p>
            <p className={`font-medium ${plColor}`}>
              {pl >= 0 ? "+" : ""}
              {plPercent.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Average Cost / {investmentAccount.unit_label}</p>
            <p className="font-medium">
              {averageCost != null ? formatCurrency(averageCost, "IDR") : "—"}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="text-muted-foreground text-xs">Nilai Pasar Diupdate</p>
            <p className="font-medium capitalize">{updatedAgo}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
