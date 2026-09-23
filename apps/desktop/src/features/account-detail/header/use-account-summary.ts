import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export type AccountSummary = {
  income: number;
  expense: number;
};

export const accountSummaryQueryKey = ["transactions", "account-summary"];

/**
 * Ringkasan uang masuk/keluar untuk SATU akun, dihitung dari seluruh
 * transaksinya (bukan cuma halaman yang sedang ditampilkan di list) —
 * makanya query SUM langsung, bukan derive dari data list yang
 * dipaginasi. "Masuk" = transaksi income di akun ini + transfer MASUK
 * dari akun lain (`transfer_account_id`). "Keluar" = transaksi expense
 * di akun ini + transfer KELUAR ke akun lain (`account_id` pada baris
 * transfer, uangnya meninggalkan akun ini).
 */
export function useAccountSummary(accountId: number) {
  return useQuery({
    queryKey: [...accountSummaryQueryKey, accountId],
    queryFn: async () => {
      const db = await getDb();
      const rows = await db.select<{ bucket: "income" | "expense"; total: number }[]>(
        `SELECT 'income' as bucket, COALESCE(SUM(amount), 0) as total
         FROM transactions
         WHERE (type = 'income' AND account_id = $1)
            OR (type = 'transfer' AND transfer_account_id = $1)
         UNION ALL
         SELECT 'expense' as bucket, COALESCE(SUM(amount), 0) as total
         FROM transactions
         WHERE (type = 'expense' AND account_id = $1)
            OR (type = 'transfer' AND account_id = $1)`,
        [accountId]
      );

      const summary: AccountSummary = { income: 0, expense: 0 };
      for (const row of rows) {
        summary[row.bucket] = row.total;
      }
      return summary;
    },
  });
}
