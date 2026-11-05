import { useCallback } from "react";
import { useDatabase } from "@/lib/database";
import { EXCLUDE_THIRD_PARTY_TRANSACTIONS_SQL } from "@/shared/third-party-funds";
import { toListItem, type TransactionRow } from "@/features/transactions/content/use-transactions";
import { useReportQuery } from "../../shared/use-report-query";
import type { CashflowGroupBy } from "../use-cashflow-breakdown";
import type { CashflowDetailTransaction } from "./cashflow-detail-data";

const EMPTY: CashflowDetailTransaction[] = [];

// Daftar SEMUA transaksi penyusun satu baris breakdown Cashflow (drill-down). Filter dasar
// sama dengan use-cashflow-breakdown.ts dan use-cashflow-transactions.ts desktop: tipe + rentang
// tanggal + satu group_key. Tidak difilter ke anak di SQL — filter anak dilakukan di klien,
// karena total tiap anak dihitung dari seluruh transaksi grup.
const SELECT = `
  SELECT transactions.*,
    (SELECT name FROM categories WHERE categories.id = transactions.category_id) AS category_name,
    (SELECT name FROM accounts WHERE accounts.id = transactions.account_id) AS account_name,
    (SELECT name FROM accounts WHERE accounts.id = transactions.transfer_account_id) AS transfer_account_name
  FROM transactions`;

const BASE_WHERE = `transactions.type = ? AND date(transactions.date) BETWEEN ? AND ?
  AND transactions.is_cash_neutral = 0 AND ${EXCLUDE_THIRD_PARTY_TRANSACTIONS_SQL}`;

function buildQuery(groupBy: CashflowGroupBy, groupKey: string | null) {
  if (groupBy === "account_group") {
    return {
      sql: `${SELECT}
        JOIN accounts a ON a.id = transactions.account_id
        WHERE ${BASE_WHERE} AND ${groupKey ? "a.group_id = ?" : "a.group_id IS NULL"}
        ORDER BY transactions.date DESC, transactions.created_at DESC`,
      groupParams: groupKey ? [groupKey] : [],
    };
  }

  return {
    sql: `${SELECT}
      LEFT JOIN categories c ON c.id = transactions.category_id
      LEFT JOIN categories parent ON parent.id = c.parent_id
      WHERE ${BASE_WHERE} AND ${groupKey ? "COALESCE(parent.id, c.id) = ?" : "c.id IS NULL"}
      ORDER BY transactions.date DESC, transactions.created_at DESC`,
    groupParams: groupKey ? [groupKey] : [],
  };
}

export function useCashflowTransactions(
  from: string,
  to: string,
  type: "income" | "expense",
  groupBy: CashflowGroupBy,
  groupKey: string | null
) {
  const db = useDatabase();

  const fetcher = useCallback(async (): Promise<CashflowDetailTransaction[]> => {
    const { sql, groupParams } = buildQuery(groupBy, groupKey);
    const rows = await db.getAllAsync<TransactionRow>(sql, [type, from, to, ...groupParams]);
    return rows.map((row) => ({
      ...toListItem(row),
      accountId: row.account_id,
      categoryId: row.category_id,
    }));
  }, [db, from, to, type, groupBy, groupKey]);

  return useReportQuery(`${from}|${to}|${type}|${groupBy}|${groupKey ?? ""}`, fetcher, EMPTY);
}
