import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useDatabase } from "@/lib/database";
import { buildWhereClause } from "@/components/query/filters/builders/sql";
import type { FilterConfig } from "@/components/query/filters/filter.interface";

const ALLOWED_FILTER_COLUMNS = [
  "note",
  "description",
  "type",
  "category_id",
  "account_id",
  "amount",
  "has_attachment",
  "date",
] as const;

interface SummaryRow {
  income: number | null;
  expense: number | null;
}

function toPositionalPlaceholders(clause: string): string {
  return clause.replace(/\$\d+/g, "?");
}

export interface TransactionSummaryData {
  income: number;
  expense: number;
  total: number;
}

export function useTransactionSummary({ filters = [] }: { filters?: FilterConfig[] } = {}) {
  const db = useDatabase();
  const [summary, setSummary] = useState<TransactionSummaryData>({
    income: 0,
    expense: 0,
    total: 0,
  });

  const refetch = useCallback(async () => {
    const { whereClause, params } = buildWhereClause(filters, ALLOWED_FILTER_COLUMNS);

    const sql = toPositionalPlaceholders(
      `SELECT
         SUM(CASE WHEN type = 'income' AND is_cash_neutral = 0 THEN amount ELSE 0 END) AS income,
         SUM(CASE WHEN type = 'expense' AND is_cash_neutral = 0 THEN amount ELSE 0 END) AS expense
       FROM transactions ${whereClause}`
    );

    const row = await db.getFirstAsync<SummaryRow>(sql, params);
    const income = row?.income ?? 0;
    const expense = row?.expense ?? 0;
    setSummary({ income, expense, total: income - expense });
  }, [db, filters]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  return summary;
}
