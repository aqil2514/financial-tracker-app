import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export const investmentSalesQueryKey = ["investment_sales"];

export type InvestmentSaleRow = {
  id: string;
  account_id: string;
  transaction_id: string | null;
  unit: number;
  price_per_unit: number;
  /** NULL selama `status === 'pending'` — belum dihitung sama sekali
   * (keputusan 2026-10-07, migrasi 0041). Diisi saat settle. */
  average_cost_per_unit: number | null;
  /** NULL selama `status === 'pending'` — belum final (average cost bisa
   * masih bergeser sebelum settle). Diisi saat settle, snapshot permanen
   * setelahnya. */
  realized_pl: number | null;
  date: string;
  status: "pending" | "settled";
  created_at: string;
};

/** Riwayat penjualan (lot) SATU akun investment, terbaru dulu — pola
 * persis `useInvestmentPurchases`, arah sebaliknya. `realized_pl` di sini
 * adalah snapshot PERMANEN (dihitung sekali saat SETTLE, lihat
 * apply-sell-investment-transaction.ts), bukan live-computed — jadi
 * ditampilkan apa adanya tanpa perhitungan ulang di sisi UI. */
export function useInvestmentSales(accountId: string | undefined) {
  return useQuery({
    queryKey: [...investmentSalesQueryKey, accountId],
    enabled: accountId != null,
    queryFn: async (): Promise<InvestmentSaleRow[]> => {
      const db = await getDb();
      return db.select<InvestmentSaleRow[]>(
        `SELECT id, account_id, transaction_id, unit, price_per_unit, average_cost_per_unit, realized_pl, date, status, created_at
         FROM investment_sales
         WHERE account_id = $1
         ORDER BY date DESC, created_at DESC`,
        [accountId]
      );
    },
  });
}
