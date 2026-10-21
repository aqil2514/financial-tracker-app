"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { Account } from "@/lib/db";
import { getDb } from "@/lib/db";
import { useAccounts } from "@/hooks/resources/use-accounts";
import { useDeleteAccount } from "./use-delete-account";
import { useThirdPartyFundCount } from "./use-third-party-fund-count";

type RelationAction = "unassign" | "reassign";

function useTransactionCountByAccount(accountId: string) {
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
  // FK third_party_funds.account_id ON DELETE CASCADE bikin unassign/
  // reassign men-drop riwayat titip/ambil dengan cara yang tidak
  // konsisten (lihat use-third-party-fund-count.ts) -- dilarang total
  // selama masih ada riwayat, apa pun transactionAction yang dipilih.
  const isThirdParty = account.account_type === "third_party";
  const { data: thirdPartyFundCount } = useThirdPartyFundCount(account.id, isThirdParty);
  const hasThirdPartyFunds = isThirdParty && (thirdPartyFundCount ?? 0) > 0;
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
    if (hasThirdPartyFunds) return;

    deleteAccount.mutate(
      {
        id: account.id,
        transactionAction: hasTransactions ? transactionAction : undefined,
        targetAccountId:
          hasTransactions && transactionAction === "reassign" && isTargetAccountValid
            ? (targetAccountId ?? undefined)
            : undefined,
      },
      { onSuccess: () => setOpen(false) }
    );
  }

  const canConfirm =
    !hasThirdPartyFunds &&
    (!hasTransactions ||
      transactionAction === "unassign" ||
      (transactionAction === "reassign" && isTargetAccountValid));

  return {
    transactionAction,
    setTransactionAction,
    targetAccountId,
    setTargetAccountId,
    otherAccounts,
    hasTransactions,
    transactionCount,
    hasThirdPartyFunds,
    thirdPartyFundCount,
    canConfirm,
    handleConfirm,
    isPending: deleteAccount.isPending,
  };
}
