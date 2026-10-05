import { useQuery } from "@tanstack/react-query";
import { getDb, type Transaction } from "@/lib/db";
import type { CashflowGroupBy } from "./use-cashflow-breakdown";

export const cashflowTransactionsQueryKey = ["reports", "cashflow-transactions"];

// Daftar SEMUA transaksi penyusun satu baris breakdown Cashflow
// (drill-down dialog) -- filter dasarnya PERSIS sama dengan
// use-cashflow-breakdown.ts (type + rentang tanggal + satu group_key
// spesifik). TIDAK difilter ke anak tertentu di SQL -- dialog butuh
// seluruh transaksi grup induk sekaligus utk (a) breakdown per anak di
// panel kanan DAN (b) list+chart yang di-filter childId di client,
// jadi 1 query dipakai utk keduanya daripada fetch ulang per child.
export function useCashflowTransactions(
  from: string,
  to: string,
  type: "income" | "expense",
  groupBy: CashflowGroupBy,
  groupKey: string | null
) {
  return useQuery({
    queryKey: [...cashflowTransactionsQueryKey, from, to, type, groupBy, groupKey],
    queryFn: async () => {
      const db = await getDb();
      const params: unknown[] = [type, from, to];

      if (groupBy === "account_group") {
        const groupCondition = groupKey ? `a.group_id = $${params.push(groupKey)}` : "a.group_id IS NULL";

        return db.select<Transaction[]>(
          `SELECT t.* FROM transactions t
           JOIN accounts a ON a.id = t.account_id
           WHERE t.type = $1 AND date(t.date) BETWEEN $2 AND $3 AND ${groupCondition}
           ORDER BY t.date DESC`,
          params
        );
      }

      const groupCondition = groupKey
        ? `COALESCE(parent.id, c.id) = $${params.push(groupKey)}`
        : "c.id IS NULL";

      return db.select<Transaction[]>(
        `SELECT t.* FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id
         LEFT JOIN categories parent ON parent.id = c.parent_id
         WHERE t.type = $1 AND date(t.date) BETWEEN $2 AND $3 AND ${groupCondition}
         ORDER BY t.date DESC`,
        params
      );
    },
  });
}
