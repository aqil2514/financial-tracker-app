import { useCallback } from "react";
import { useDatabase } from "@/lib/database";
import { useReportQuery } from "../shared/use-report-query";

export interface AccountTypeBalanceRow {
  account_type: "cash" | "debt" | "investment" | "third_party" | "forex";
  total: number;
  // Hanya terisi untuk 'investment' dan 'forex' (unit x kurs): nilai terkini akun aktif. MURNI informasional untuk
  // baris "Unrealized P/L", tidak pernah ikut ke `total`/pie (agregat kekayaan berbasis modal,
  // lihat docs/concept/konsep-investasi.md).
  total_market_value: number | null;
}

const EMPTY_ROWS: AccountTypeBalanceRow[] = [];

// Rumus saldo dan filter akun aktif sama dengan desktop (use-balances-by-account-type.ts).
export function useBalancesByAccountType() {
  const db = useDatabase();

  const fetcher = useCallback(
    () =>
      db.getAllAsync<AccountTypeBalanceRow>(
        `SELECT a.account_type AS account_type,
           SUM(
             a.initial_balance
               + COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'income'), 0)
               - COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'expense'), 0)
               - COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'transfer'), 0)
               + COALESCE((SELECT SUM(amount) FROM transactions WHERE transfer_account_id = a.id AND type = 'transfer'), 0)
           ) AS total,
           CASE
             WHEN a.account_type = 'investment'
               THEN SUM(COALESCE((SELECT ia.current_market_value FROM investment_accounts ia WHERE ia.account_id = a.id), 0))
             WHEN a.account_type = 'forex'
               THEN SUM(
                 COALESCE((SELECT fa.current_rate FROM forex_accounts fa WHERE fa.account_id = a.id), 0)
                 * (COALESCE((SELECT SUM(unit) FROM forex_purchases WHERE account_id = a.id), 0)
                    - COALESCE((SELECT SUM(unit) FROM forex_sales WHERE account_id = a.id), 0))
               )
             ELSE NULL
           END AS total_market_value
         FROM accounts a
         WHERE a.is_active = 1
         GROUP BY a.account_type
         ORDER BY total DESC`
      ),
    [db]
  );

  return useReportQuery("account-type", fetcher, EMPTY_ROWS);
}
