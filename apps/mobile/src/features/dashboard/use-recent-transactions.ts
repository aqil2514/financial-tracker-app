import { useCallback } from "react";
import { useDatabase } from "@/lib/database";
import { toListItem, type TransactionRow } from "@/features/transactions/content/use-transactions";
import type { TransactionListItem } from "@/features/transactions/types";
import { useReportQuery } from "@/features/reports/shared/use-report-query";

const RECENT_LIMIT = 5;
const EMPTY: TransactionListItem[] = [];

export function useRecentTransactions() {
  const db = useDatabase();

  const fetcher = useCallback(async () => {
    const rows = await db.getAllAsync<TransactionRow>(
      `SELECT transactions.*,
              (SELECT name FROM categories WHERE categories.id = transactions.category_id) as category_name,
              (SELECT name FROM accounts WHERE accounts.id = transactions.account_id) as account_name,
              (SELECT name FROM accounts WHERE accounts.id = transactions.transfer_account_id) as transfer_account_name
       FROM transactions
       ORDER BY date DESC, created_at DESC
       LIMIT ${RECENT_LIMIT}`
    );
    return rows.map(toListItem);
  }, [db]);

  return useReportQuery("recent", fetcher, EMPTY);
}
