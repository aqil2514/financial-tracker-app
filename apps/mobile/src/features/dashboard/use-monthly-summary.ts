import { useCallback } from "react";
import { useDatabase } from "@/lib/database";
import { EXCLUDE_THIRD_PARTY_TRANSACTIONS_SQL } from "@/shared/third-party-funds";
import { currentMonth, shiftMonth } from "@/lib/utils/month";
import { useReportQuery } from "@/features/reports/shared/use-report-query";
import { buildMonthlySummaryRows, type MonthlySummaryRow, type MonthlyTotalRow } from "./monthly-summary-rows";

const EMPTY: MonthlySummaryRow[] = [];

// Filter sama dengan desktop (use-monthly-summary.ts). Beda: desktop mundur `months` bulan penuh
// (jadi 7 bulan termasuk bulan ini), di sini tepat `months` bulan berakhir di bulan ini.
export function useMonthlySummary(months: number) {
  const db = useDatabase();
  const endMonth = currentMonth();

  const fetcher = useCallback(async () => {
    const startMonth = shiftMonth(endMonth, -(months - 1));
    const rows = await db.getAllAsync<MonthlyTotalRow>(
      `SELECT strftime('%Y-%m', date) AS month, type, SUM(amount) AS total
       FROM transactions
       WHERE type IN ('income', 'expense')
         AND is_cash_neutral = 0
         AND ${EXCLUDE_THIRD_PARTY_TRANSACTIONS_SQL}
         AND date >= ?
       GROUP BY month, type`,
      [`${startMonth}-01`]
    );
    return buildMonthlySummaryRows(rows, months, endMonth);
  }, [db, months, endMonth]);

  return useReportQuery(`${months}|${endMonth}`, fetcher, EMPTY);
}
