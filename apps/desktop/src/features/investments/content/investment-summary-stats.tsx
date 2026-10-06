"use client";

import { Card, CardContent } from "@/components/ui/card";
import { QueryState } from "@/components/query-state";
import { formatCurrency } from "@/lib/format-currency";
import type { AccountWithBalance } from "@/features/accounts";
import { useAllInvestmentAccounts } from "@/shared/investments/use-all-investment-accounts";

/** Kartu P/L gabungan SEMUA akun investment — total modal, total nilai
 * pasar, total Unrealized P/L. Pola SUM yang sama persis dengan
 * `InvestmentPlStats` (header halaman detail), cuma di-agregasi lintas
 * akun di sini alih-alih 1 akun. Modal tetap dari `accounts.balance`
 * (lihat docs/concept/konsep-investasi.md) — bukan dari
 * `investment_accounts`. */
export function InvestmentSummaryStats({ investmentAccounts }: { investmentAccounts: AccountWithBalance[] }) {
  const { data: marketValues, isLoading, error } = useAllInvestmentAccounts();

  if (isLoading || error) {
    return (
      <Card>
        <CardContent>
          <QueryState isLoading={isLoading} error={error} />
        </CardContent>
      </Card>
    );
  }

  if (investmentAccounts.length === 0) return null;

  const marketValueByAccountId = new Map((marketValues ?? []).map((row) => [row.account_id, row.current_market_value]));

  const totalModal = investmentAccounts.reduce((sum, account) => sum + account.balance, 0);
  // Akun yang belum punya baris investment_accounts (seharusnya tidak
  // terjadi -- selalu dibuat bareng saat akun investment baru dibuat,
  // lihat use-create-account.ts) dianggap nilai pasarnya 0, bukan
  // menghilang dari total, supaya jumlah akun di breakdown tetap konsisten.
  const totalMarketValue = investmentAccounts.reduce(
    (sum, account) => sum + (marketValueByAccountId.get(account.id) ?? 0),
    0
  );
  const totalPl = totalMarketValue - totalModal;
  const totalPlPercent = totalModal !== 0 ? (totalPl / totalModal) * 100 : 0;
  const plColor = totalPl >= 0 ? "text-green-600" : "text-red-600";

  return (
    <Card>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground text-xs">Total Modal</p>
            <p className="font-medium">{formatCurrency(totalModal, "IDR")}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Total Nilai Pasar</p>
            <p className="font-medium">{formatCurrency(totalMarketValue, "IDR")}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Total Unrealized P/L</p>
            <p className={`font-medium ${plColor}`}>
              {totalPl >= 0 ? "+" : ""}
              {formatCurrency(totalPl, "IDR")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">P/L (% posisi aktif)</p>
            <p className={`font-medium ${plColor}`}>
              {totalPl >= 0 ? "+" : ""}
              {totalPlPercent.toFixed(2)}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
