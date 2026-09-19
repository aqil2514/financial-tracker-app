"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { AccountWithBalance } from "../../calculate-balance";
import { useCorrectAccountBalance } from "./use-correct-account-balance";
import {
  accountBalanceCorrectionSchema,
  type AccountBalanceCorrectionFormOutput,
  type AccountBalanceCorrectionFormValues,
} from "./schema";

export function useBalanceCorrectionForm(
  account: AccountWithBalance,
  open: boolean,
  onOpenChange: (open: boolean) => void
) {
  const form = useForm<AccountBalanceCorrectionFormValues, unknown, AccountBalanceCorrectionFormOutput>({
    resolver: zodResolver(accountBalanceCorrectionSchema),
    defaultValues: { targetBalance: account.balance },
  });

  useEffect(() => {
    if (open) form.reset({ targetBalance: account.balance });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, account.balance]);

  const correctBalance = useCorrectAccountBalance();

  function onSubmit(values: AccountBalanceCorrectionFormOutput) {
    correctBalance.mutate(
      {
        accountId: account.id,
        targetBalance: values.targetBalance,
        currentBalance: account.balance,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  return { form, onSubmit, isPending: correctBalance.isPending };
}
