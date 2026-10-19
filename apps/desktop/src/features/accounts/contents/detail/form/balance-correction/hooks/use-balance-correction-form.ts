"use client";

import type { AccountWithBalance } from "../../../../../calculate-balance";
import { useCorrectAccountBalance } from "./use-correct-account-balance";
import type { AccountBalanceCorrectionFormOutput } from "../schema";

export function useBalanceCorrectionForm(
  account: AccountWithBalance,
  onOpenChange: (open: boolean) => void
) {
  const correctBalance = useCorrectAccountBalance();

  function onSubmit(values: AccountBalanceCorrectionFormOutput) {
    correctBalance.mutate(
      {
        accountId: account.id,
        accountType: account.account_type,
        targetBalance: values.targetBalance,
        currentBalance: account.balance,
        countAsCash: values.countAsCash,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  return { onSubmit, isPending: correctBalance.isPending };
}
