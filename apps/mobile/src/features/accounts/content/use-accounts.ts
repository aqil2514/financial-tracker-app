import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useDatabase } from "@/lib/database";
import { AccountListItem } from "../types";

interface AccountRow {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  account_type: "cash" | "debt" | "investment" | "third_party";
  group_id: string | null;
  group_name: string | null;
  is_active: number;
  balance: number;
}

function toListItem(row: AccountRow): AccountListItem {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    accountType: row.account_type,
    groupId: row.group_id,
    groupName: row.group_name,
    isActive: row.is_active === 1,
    balance: row.balance,
  };
}

export function useAccounts() {
  const db = useDatabase();
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await db.getAllAsync<AccountRow>(
        `SELECT
           accounts.id,
           accounts.name,
           accounts.icon,
           accounts.color,
           accounts.account_type,
           accounts.group_id,
           account_groups.name AS group_name,
           accounts.is_active,
           (
             accounts.initial_balance
             + COALESCE((SELECT SUM(CASE
                   WHEN t.type = 'income' THEN t.amount
                   WHEN t.type = 'expense' THEN -t.amount
                   WHEN t.type = 'transfer' THEN -t.amount
                   ELSE 0 END)
                 FROM transactions t WHERE t.account_id = accounts.id), 0)
             + COALESCE((SELECT SUM(t.amount) FROM transactions t
                 WHERE t.type = 'transfer' AND t.transfer_account_id = accounts.id), 0)
           ) AS balance
         FROM accounts
         LEFT JOIN account_groups ON account_groups.id = accounts.group_id
         ORDER BY accounts.name ASC`
      );
      setAccounts(rows.map(toListItem));
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const toggleActive = useCallback(
    async (id: string, nextIsActive: boolean) => {
      await db.runAsync(`UPDATE accounts SET is_active = ? WHERE id = ?`, [
        nextIsActive ? 1 : 0,
        id,
      ]);
      await refetch();
    },
    [db, refetch]
  );

  return { accounts, isLoading, refetch, toggleActive };
}
