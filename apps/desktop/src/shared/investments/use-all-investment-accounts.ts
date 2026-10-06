import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";
import { investmentAccountQueryKey } from "./use-investment-account";

export type AllInvestmentAccountsRow = {
  account_id: string;
  unit_label: string;
  current_market_value: number;
};

/** Semua baris `investment_accounts` sekaligus — dipakai tab Ringkasan
 * `/investments` (kartu P/L gabungan) untuk SUM `current_market_value`
 * lintas akun, beda dari `useInvestmentAccount` yang scoped ke 1 akun.
 * Pakai base key yang SAMA (`investmentAccountQueryKey`) jadi otomatis
 * ikut ter-invalidate kapan pun satu akun investasi diedit — TIDAK perlu
 * didaftarkan ulang di QUERY_DEPENDENCIES. */
export function useAllInvestmentAccounts() {
  return useQuery({
    queryKey: [...investmentAccountQueryKey, "all"],
    queryFn: async (): Promise<AllInvestmentAccountsRow[]> => {
      const db = await getDb();
      return db.select<AllInvestmentAccountsRow[]>(
        "SELECT account_id, unit_label, current_market_value FROM investment_accounts"
      );
    },
  });
}
