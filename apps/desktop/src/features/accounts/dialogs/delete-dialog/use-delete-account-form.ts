"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { Account } from "@/lib/db";
import { getDb } from "@/lib/db";
import { useAccounts } from "@/hooks/resources/use-accounts";
import { useDeleteAccount } from "../../sections/list/use-delete-account";

type RelationAction = "unassign" | "reassign";

function useTransactionCountByAccount(accountId: number) {
  return useQuery({
    queryKey: ["accounts", "transaction-count", accountId],
    queryFn: async () => {
      const db = await getDb();
      const [{ count }] = await db.select<{ count: number }[]>(
        "SELECT COUNT(*) as count FROM transactions WHERE account_id = $1 OR transfer_account_id = $1",
        [accountId]
      );
      return count;
    },
  });
}

export function useDeleteAccountForm(
  account: Account,
  open: boolean,
  setOpen: (open: boolean) => void
) {
  const [transactionAction, setTransactionAction] = useState<RelationAction>("unassign");
  const [targetAccountId, setTargetAccountId] = useState<string | null>(null);

  const { data: accounts } = useAccounts();
  const { data: transactionCount } = useTransactionCountByAccount(account.id);
  const deleteAccount = useDeleteAccount();

  useEffect(() => {
    if (open) {
      setTransactionAction("unassign");
      setTargetAccountId(null);
    }
  }, [open]);

  const otherAccounts = useMemo(
    () => (accounts ?? []).filter((a) => a.id !== account.id),
    [accounts, account.id]
  );

  const hasTransactions = (transactionCount ?? 0) > 0;
  const isTargetAccountValid =
    targetAccountId != null && otherAccounts.some((a) => String(a.id) === targetAccountId);

  function handleConfirm() {
    deleteAccount.mutate(
      {
        id: account.id,
        transactionAction: hasTransactions ? transactionAction : undefined,
        targetAccountId:
          hasTransactions && transactionAction === "reassign" && isTargetAccountValid
            ? Number(targetAccountId)
            : undefined,
      },
      { onSuccess: () => setOpen(false) }
    );
  }

  const canConfirm =
    !hasTransactions ||
    transactionAction === "unassign" ||
    (transactionAction === "reassign" && isTargetAccountValid);

  return {
    transactionAction,
    setTransactionAction,
    targetAccountId,
    setTargetAccountId,
    otherAccounts,
    hasTransactions,
    transactionCount,
    canConfirm,
    handleConfirm,
    isPending: deleteAccount.isPending,
  };
}
