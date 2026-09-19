import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { getDb } from "@/lib/db";

export type AccountMonthSummary = {
  income: number;
  expense: number;
  /** Net transfer masuk - keluar akun ini pada bulan tsb — transfer
   * bukan income/expense akuntansi, tapi tetap menggerakkan saldo akun
   * spesifik ini, jadi ditampilkan sebagai kategori terpisah. */
  transfer: number;
};

export function useAccountMonthSummary(accountId: number, month: Date) {
  const monthKey = format(month, "yyyy-MM");

  return useQuery({
    queryKey: ["accounts", "month-summary", accountId, monthKey],
    queryFn: async (): Promise<AccountMonthSummary> => {
      const db = await getDb();

      const [incomeExpenseRows, transferInRows, transferOutRows] = await Promise.all([
        db.select<{ type: "income" | "expense"; total: number }[]>(
          `SELECT type, SUM(amount) as total
           FROM transactions
           WHERE account_id = $1
             AND type IN ('income', 'expense')
             AND strftime('%Y-%m', date) = $2
           GROUP BY type`,
          [accountId, monthKey]
        ),
        db.select<{ total: number | null }[]>(
          `SELECT SUM(amount) as total
           FROM transactions
           WHERE type = 'transfer'
             AND transfer_account_id = $1
             AND strftime('%Y-%m', date) = $2`,
          [accountId, monthKey]
        ),
        db.select<{ total: number | null }[]>(
          `SELECT SUM(amount) as total
           FROM transactions
           WHERE type = 'transfer'
             AND account_id = $1
             AND strftime('%Y-%m', date) = $2`,
          [accountId, monthKey]
        ),
      ]);

      const summary: AccountMonthSummary = { income: 0, expense: 0, transfer: 0 };
      for (const row of incomeExpenseRows) {
        summary[row.type] = row.total;
      }

      const transferIn = transferInRows[0]?.total ?? 0;
      const transferOut = transferOutRows[0]?.total ?? 0;
      summary.transfer = transferIn - transferOut;

      return summary;
    },
  });
}
