import { useCallback } from "react";
import { useDatabase } from "@/lib/database";
import { EXCLUDE_THIRD_PARTY_TRANSACTIONS_SQL } from "@/shared/third-party-funds";
import { toListItem, type TransactionRow } from "@/features/transactions/content/use-transactions";
import type { TransactionListItem } from "@/features/transactions/types";
import { TRANSACTION_LIST_SELECT } from "../shared/transaction-select";
import { useReportQuery } from "../shared/use-report-query";

const EMPTY: TransactionListItem[] = [];

// Transaksi (income/expense) dalam rentang tanggal periode, dengan kategori yang termasuk periode.
// Filter sama dengan use-category-period-transactions.ts desktop: tanpa netral kas dan dana pihak
// ketiga. Ringkasan dan data grafik diturunkan dari daftar ini di klien.
export function useCategoryPeriodTransactions(periodId: string | null) {
  const db = useDatabase();

  const fetcher = useCallback(async (): Promise<TransactionListItem[]> => {
    if (!periodId) return [];
    const rows = await db.getAllAsync<TransactionRow>(
      `${TRANSACTION_LIST_SELECT}
       JOIN category_periods p ON p.id = ?
       WHERE transactions.type IN ('income', 'expense')
         AND transactions.is_cash_neutral = 0
         AND ${EXCLUDE_THIRD_PARTY_TRANSACTIONS_SQL}
         AND date(transactions.date) BETWEEN p.start_date AND p.end_date
         AND transactions.category_id IN (
           SELECT category_id FROM category_period_categories WHERE period_id = p.id
         )
       ORDER BY transactions.date DESC, transactions.created_at DESC`,
      [periodId]
    );
    return rows.map(toListItem);
  }, [db, periodId]);

  return useReportQuery(periodId ?? "none", fetcher, EMPTY);
}
