import { useCallback } from "react";
import { useDatabase } from "@/lib/database";
import { EXCLUDE_THIRD_PARTY_TRANSACTIONS_SQL } from "@/shared/third-party-funds";
import { useReportQuery } from "../shared/use-report-query";

const EMPTY_ROWS: CashflowBreakdownRow[] = [];

export interface CashflowBreakdownRow {
  // account_groups.id atau id kategori induk; null = bucket "Tanpa Grup"/"Tanpa Kategori".
  group_key: string | null;
  label: string;
  total: number;
}

// Dimensi "Label" milik desktop belum ada di mobile (belum ada tabel label) — lihat porting-labels.md.
export type CashflowGroupBy = "account_group" | "parent_category";

const BASE_WHERE = `transactions.type = ? AND date(transactions.date) BETWEEN ? AND ?
  AND transactions.is_cash_neutral = 0 AND ${EXCLUDE_THIRD_PARTY_TRANSACTIONS_SQL}`;

// Sama dengan desktop (use-cashflow-breakdown.ts): GROUP BY id, bukan nama, supaya dua grup/kategori
// beda id tapi nama sama tidak tergabung; kategori anak digabung ke induknya.
const QUERY_BY_GROUP_BY: Record<CashflowGroupBy, string> = {
  account_group: `
    SELECT g.id AS group_key, COALESCE(g.name, 'Tanpa Grup') AS label, SUM(transactions.amount) AS total
    FROM transactions
    JOIN accounts a ON a.id = transactions.account_id
    LEFT JOIN account_groups g ON g.id = a.group_id
    WHERE ${BASE_WHERE}
    GROUP BY g.id
    ORDER BY total DESC`,
  parent_category: `
    SELECT
      COALESCE(parent.id, c.id) AS group_key,
      COALESCE(parent.name, c.name, 'Tanpa Kategori') AS label,
      SUM(transactions.amount) AS total
    FROM transactions
    LEFT JOIN categories c ON c.id = transactions.category_id
    LEFT JOIN categories parent ON parent.id = c.parent_id
    WHERE ${BASE_WHERE}
    GROUP BY group_key
    ORDER BY total DESC`,
};

export function useCashflowBreakdown(
  from: string,
  to: string,
  type: "income" | "expense",
  groupBy: CashflowGroupBy
) {
  const db = useDatabase();

  const fetcher = useCallback(
    () => db.getAllAsync<CashflowBreakdownRow>(QUERY_BY_GROUP_BY[groupBy], [type, from, to]),
    [db, from, to, type, groupBy]
  );

  return useReportQuery(`${from}|${to}|${type}|${groupBy}`, fetcher, EMPTY_ROWS);
}
