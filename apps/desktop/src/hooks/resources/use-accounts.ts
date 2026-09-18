import { useQuery } from "@tanstack/react-query";
import { getDb, type Account } from "@/lib/db";
import type { AccountWithBalance } from "@/features/accounts/list/calculate-balance";

export const accountsQueryKey = ["accounts-with-balance"];

export type { AccountWithBalance };

// `balance`/`group_name` bukan kolom SQL asli — dihitung lewat subquery
// agregat yang meniru logika calculateAccountBalance() (initial_balance +
// income - expense - transfer keluar + transfer masuk), plus LEFT JOIN
// ke account_groups. Dihitung di SQL (bukan tarik seluruh tabel
// transactions ke JS) supaya query ini tetap O(log N) per akun lewat
// index, bukan O(N) linear terhadap total transaksi seumur hidup.
const SELECT_ACCOUNTS_WITH_BALANCE = `
  SELECT
    accounts.*,
    (
      accounts.initial_balance
      + COALESCE((
          SELECT SUM(
            CASE
              WHEN t.type = 'income' THEN t.amount
              WHEN t.type = 'expense' THEN -t.amount
              WHEN t.type = 'transfer' THEN -t.amount
              ELSE 0
            END
          )
          FROM transactions t
          WHERE t.account_id = accounts.id
        ), 0)
      + COALESCE((
          SELECT SUM(t.amount)
          FROM transactions t
          WHERE t.type = 'transfer' AND t.transfer_account_id = accounts.id
        ), 0)
    ) AS balance,
    account_groups.name AS group_name
  FROM accounts
  LEFT JOIN account_groups ON account_groups.id = accounts.group_id
  ORDER BY accounts.name COLLATE NOCASE
`;

type AccountRow = Account & { balance: number; group_name: string | null };

export function useAccounts() {
  return useQuery({
    queryKey: accountsQueryKey,
    queryFn: async (): Promise<AccountWithBalance[]> => {
      const db = await getDb();
      return db.select<AccountRow[]>(SELECT_ACCOUNTS_WITH_BALANCE);
    },
  });
}
