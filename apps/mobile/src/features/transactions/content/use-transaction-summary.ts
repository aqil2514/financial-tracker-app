import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useDatabase } from "@/lib/database";
import { EXCLUDE_THIRD_PARTY_TRANSACTIONS_SQL } from "@/shared/third-party-funds";
import { buildWhereClause } from "@/components/query/filters/builders/sql";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import { extractLabelCondition } from "@/features/labels/extract-label-condition";

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

const JSON_TEXT_COLUMNS = ["description"] as const;

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
    const { remaining, extraConditions } = extractLabelCondition(filters);
    const { whereClause, params } = buildWhereClause(remaining, ALLOWED_FILTER_COLUMNS, extraConditions, 1, {
      jsonTextColumns: JSON_TEXT_COLUMNS,
    });

    const sql = toPositionalPlaceholders(
      `SELECT
         SUM(CASE WHEN type = 'income' AND is_cash_neutral = 0 AND ${EXCLUDE_THIRD_PARTY_TRANSACTIONS_SQL} THEN amount ELSE 0 END) AS income,
         SUM(CASE WHEN type = 'expense' AND is_cash_neutral = 0 AND ${EXCLUDE_THIRD_PARTY_TRANSACTIONS_SQL} THEN amount ELSE 0 END) AS expense
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
