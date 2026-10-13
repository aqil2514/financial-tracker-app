"use client";

import { useRouter } from "next/navigation";

import { formatCurrency } from "@/lib/format-currency";
import type { AccountWithBalance } from "@/features/accounts";
import { useAllInvestmentAccounts } from "@/shared/investments/use-all-investment-accounts";

/** Daftar ringkas P/L per akun investment — pelengkap kartu gabungan
 * `InvestmentSummaryStats` (angka total) dan pie chart (distribusi nilai
 * pasar), supaya tab Ringkasan juga menjawab "akun mana yang untung/rugi",
 * bukan cuma total gabungan. Klik baris navigasi ke detail akun, pola sama
 * `InvestmentAccountCard`. */
export function InvestmentBreakdownList({ investmentAccounts }: { investmentAccounts: AccountWithBalance[] }) {
  const router = useRouter();
  const { data: marketValues } = useAllInvestmentAccounts();

  if (investmentAccounts.length === 0) return null;

  const marketValueByAccountId = new Map((marketValues ?? []).map((row) => [row.account_id, row.current_market_value]));

  return (
    <ul className="divide-y">
      {investmentAccounts.map((account) => {
        const marketValue = marketValueByAccountId.get(account.id) ?? 0;
        const pl = marketValue - account.balance;
        const plColor = pl >= 0 ? "text-green-600" : "text-red-600";

        return (
          <li
            key={account.id}
            role="button"
            tabIndex={0}
            onClick={() => router.push(`/investments/detail?id=${account.id}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                router.push(`/investments/detail?id=${account.id}`);
              }
            }}
            className="hover:bg-accent/50 flex cursor-pointer items-center justify-between gap-3 py-2 text-sm"
          >
            <span>{account.name}</span>
            <div className="text-right">
              <p>{formatCurrency(marketValue, "IDR")}</p>
              <p className={`text-xs ${plColor}`}>
                {pl >= 0 ? "+" : ""}
                {formatCurrency(pl, "IDR")}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
