import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useDatabase } from "@/lib/database";

export interface DaySummary {
  income: number;
  expense: number;
}

export type MonthSummaryMap = Record<string, DaySummary>;

interface DaySummaryRow {
  day: string;
  income: number | null;
  expense: number | null;
}

export function useMonthSummary(month: string) {
  const db = useDatabase();
  const [summary, setSummary] = useState<MonthSummaryMap>({});

  const refetch = useCallback(async () => {
    const rows = await db.getAllAsync<DaySummaryRow>(
      `SELECT
         substr(date, 1, 10) AS day,
         SUM(CASE WHEN type = 'income' AND is_cash_neutral = 0 THEN amount ELSE 0 END) AS income,
         SUM(CASE WHEN type = 'expense' AND is_cash_neutral = 0 THEN amount ELSE 0 END) AS expense
       FROM transactions
       WHERE substr(date, 1, 7) = ?
       GROUP BY day`,
      [month]
    );

    const map: MonthSummaryMap = {};
    for (const row of rows) {
      map[row.day] = { income: row.income ?? 0, expense: row.expense ?? 0 };
    }
    setSummary(map);
  }, [db, month]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  return summary;
}
