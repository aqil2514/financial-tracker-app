import { useCallback } from "react";
import { useDatabase } from "@/lib/database";
import { EXCLUDE_THIRD_PARTY_TRANSACTIONS_SQL } from "@/shared/third-party-funds";
import { useReportQuery } from "../shared/use-report-query";

export interface CashflowSummary {
  income: number;
  expense: number;
}

const EMPTY: CashflowSummary = { income: 0, expense: 0 };

// Filter sama dengan desktop (use-cashflow-summary.ts): netral kas dan
// dana pihak ketiga tidak dihitung sebagai pemasukan/pengeluaran.
export function useCashflowSummary(from: string, to: string) {
  const db = useDatabase();

  const fetcher = useCallback(async (): Promise<CashflowSummary> => {
    const row = await db.getFirstAsync<{ income: number | null; expense: number | null }>(
      `SELECT
         SUM(CASE WHEN type = 'income' THEN amount END) AS income,
         SUM(CASE WHEN type = 'expense' THEN amount END) AS expense
       FROM transactions
       WHERE type IN ('income', 'expense')
         AND is_cash_neutral = 0
         AND ${EXCLUDE_THIRD_PARTY_TRANSACTIONS_SQL}
         AND date(date) BETWEEN ? AND ?`,
      [from, to]
    );
    return { income: row?.income ?? 0, expense: row?.expense ?? 0 };
  }, [db, from, to]);

  return useReportQuery(`${from}|${to}`, fetcher, EMPTY);
}
