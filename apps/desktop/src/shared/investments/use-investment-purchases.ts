import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export const investmentPurchasesQueryKey = ["investment_purchases"];

export type InvestmentPurchaseRow = {
  id: string;
  account_id: string;
  transaction_id: string | null;
  /** NULL kalau order masih pending dan unit belum diketahui pasti (mis.
   * reksadana yang NAB finalnya baru keluar setelah settlement) — lihat
   * migrasi 0038 dan docs/concept/konsep-investasi.md bagian "Settlement
   * tertunda". Diisi belakangan lewat edit baris saat settlement. */
  unit: number | null;
  price_per_unit: number | null;
  date: string;
  status: "pending" | "settled";
  created_at: string;
};

/** Riwayat pembelian (lot) SATU akun investment, terbaru dulu -- dipakai
 * di halaman detail (`features/investment-detail/content/`). Jumlah lot
 * per akun biasanya sedikit, jadi tanpa pagination (beda dari
 * `use-debts-list.ts` yang daftarnya bisa besar). */
export function useInvestmentPurchases(accountId: string | undefined) {
  return useQuery({
    queryKey: [...investmentPurchasesQueryKey, accountId],
    enabled: accountId != null,
    queryFn: async (): Promise<InvestmentPurchaseRow[]> => {
      const db = await getDb();
      return db.select<InvestmentPurchaseRow[]>(
        `SELECT id, account_id, transaction_id, unit, price_per_unit, date, status, created_at
         FROM investment_purchases
         WHERE account_id = $1
         ORDER BY date DESC, created_at DESC`,
        [accountId]
      );
    },
  });
}
