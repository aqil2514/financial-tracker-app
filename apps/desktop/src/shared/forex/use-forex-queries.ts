import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";
import { getForexAverageCostPerUnit, getForexRemainingUnit } from "./forex-holding-math";

// Base key didaftarkan di QUERY_DEPENDENCIES.transactions supaya ikut di-invalidate
// saat beli/jual/hapus transaksi mengubah forex_purchases/forex_sales.
export const forexPurchasesQueryKey = ["forex_purchases"];
export const forexSalesQueryKey = ["forex_sales"];
export const forexHoldingQueryKey = ["forex_holding"];

export type ForexPurchaseRow = {
  id: string;
  account_id: string;
  transaction_id: string | null;
  unit: number;
  rate: number;
  date: string;
};

export type ForexSaleRow = {
  id: string;
  account_id: string;
  transaction_id: string | null;
  unit: number;
  rate: number;
  average_cost_per_unit: number;
  realized_pl: number;
  date: string;
};

export function useForexPurchases(accountId: string | undefined) {
  return useQuery({
    queryKey: [...forexPurchasesQueryKey, accountId],
    enabled: accountId != null,
    queryFn: async (): Promise<ForexPurchaseRow[]> => {
      const db = await getDb();
      return db.select<ForexPurchaseRow[]>(
        `SELECT id, account_id, transaction_id, unit, rate, date
         FROM forex_purchases WHERE account_id = $1
         ORDER BY date DESC, created_at DESC`,
        [accountId]
      );
    },
  });
}

export function useForexSales(accountId: string | undefined) {
  return useQuery({
    queryKey: [...forexSalesQueryKey, accountId],
    enabled: accountId != null,
    queryFn: async (): Promise<ForexSaleRow[]> => {
      const db = await getDb();
      return db.select<ForexSaleRow[]>(
        `SELECT id, account_id, transaction_id, unit, rate, average_cost_per_unit, realized_pl, date
         FROM forex_sales WHERE account_id = $1
         ORDER BY date DESC, created_at DESC`,
        [accountId]
      );
    },
  });
}

export type ForexHoldingSummary = { averageCostPerUnit: number; remainingUnit: number };

// Sisa unit + average cost satu akun: dipakai kartu statistik detail dan form jual.
export function useForexHoldingSummary(accountId: string | undefined) {
  return useQuery({
    queryKey: [...forexHoldingQueryKey, accountId],
    enabled: accountId != null,
    queryFn: async (): Promise<ForexHoldingSummary> => {
      const db = await getDb();
      const [averageCostPerUnit, remainingUnit] = await Promise.all([
        getForexAverageCostPerUnit(db, accountId as string),
        getForexRemainingUnit(db, accountId as string),
      ]);
      return { averageCostPerUnit, remainingUnit };
    },
  });
}

export type ForexAccountSummaryRow = {
  account_id: string;
  country: string;
  currency: string;
  current_rate: number;
  remaining_unit: number;
};

// Semua akun valas sekaligus (kartu daftar). Memakai key forex_accounts supaya ikut
// di-invalidate bersama edit akun dan transaksi.
export function useAllForexAccountSummaries() {
  return useQuery({
    queryKey: ["forex_accounts", "summaries"],
    queryFn: async (): Promise<ForexAccountSummaryRow[]> => {
      const db = await getDb();
      return db.select<ForexAccountSummaryRow[]>(
        `SELECT fa.account_id, fa.country, fa.currency, fa.current_rate,
                COALESCE((SELECT SUM(unit) FROM forex_purchases WHERE account_id = fa.account_id), 0)
                - COALESCE((SELECT SUM(unit) FROM forex_sales WHERE account_id = fa.account_id), 0)
                  AS remaining_unit
         FROM forex_accounts fa
         WHERE fa.deleted_at IS NULL`
      );
    },
  });
}
