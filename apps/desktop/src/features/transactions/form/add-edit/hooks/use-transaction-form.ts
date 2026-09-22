"use client";

import { useWatch, type UseFormReturn } from "react-hook-form";

import { useAccounts } from "@/features/accounts";
import { useCategories } from "@/features/categories";
import { useContacts } from "@/shared/contacts/use-contacts";
import { useAccountCategoryOptions } from "./use-account-category-options";
import { useTransactionDebtFields } from "./use-transaction-debt-fields";
import type { TransactionFormOutput, TransactionFormValues } from "../schema";

type UseTransactionFormParams = {
  form: UseFormReturn<TransactionFormValues, unknown, TransactionFormOutput>;
  onSubmit: (values: TransactionFormOutput) => void;
  onSubmitAndContinue?: (values: TransactionFormOutput) => void;
  transactionId?: number;
};

/**
 * Semua logic non-JSX di balik `TransactionForm` — watch field dari
 * react-hook-form, turunan state (akun sumber/tujuan bertipe debt), dan
 * kedua hook pendukung (debt fields, account/category options) — supaya
 * `transaction-form.tsx` sendiri tinggal render.
 */
export function useTransactionForm({
  form,
  onSubmit,
  onSubmitAndContinue,
  transactionId,
}: UseTransactionFormParams) {
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();

  const type = useWatch({ control: form.control, name: "type" });
  const accountId = useWatch({ control: form.control, name: "account_id" });
  const transferAccountId = useWatch({
    control: form.control,
    name: "transfer_account_id",
  });
  const categoryId = useWatch({ control: form.control, name: "category_id" });
  const contactName = useWatch({ control: form.control, name: "contact_name" });

  const { data: contacts } = useContacts();
  const contactId =
    contacts?.find(
      (contact) => contact.name.toLowerCase() === contactName?.trim().toLowerCase()
    )?.id ?? null;

  const sourceAccount = accounts?.find((account) => String(account.id) === accountId);
  const destinationAccount = accounts?.find(
    (account) => String(account.id) === transferAccountId
  );
  const sourceIsDebt = sourceAccount?.account_type === "debt";
  const destinationIsDebt = destinationAccount?.account_type === "debt";

  const { debtStatus, involvesDebtAccount, debtFieldsLocked, needsDebtAction, validateDebtFields } =
    useTransactionDebtFields({
      transactionId,
      contactId,
      type,
      sourceIsDebt,
      destinationIsDebt,
    });

  const { accountOptions, categoryOptions, renderAccountOption } = useAccountCategoryOptions({
    accounts,
    categories,
    type,
    accountId,
    transferAccountId,
    categoryId,
  });

  function handleSubmit(values: TransactionFormOutput) {
    const error = validateDebtFields(values);
    if (error) {
      form.setError(needsDebtAction && values.debt_action ? "settle_debt_ids" : "contact_name", {
        message: error,
      });
      return;
    }
    onSubmit(values);
  }

  function handleSubmitAndContinue(values: TransactionFormOutput) {
    const error = validateDebtFields(values);
    if (error) {
      form.setError(needsDebtAction && values.debt_action ? "settle_debt_ids" : "contact_name", {
        message: error,
      });
      return;
    }
    onSubmitAndContinue?.(values);
  }

  return {
    type,
    debtStatus,
    involvesDebtAccount,
    debtFieldsLocked,
    needsDebtAction,
    accountOptions,
    categoryOptions,
    renderAccountOption,
    handleSubmit,
    handleSubmitAndContinue,
  };
}
