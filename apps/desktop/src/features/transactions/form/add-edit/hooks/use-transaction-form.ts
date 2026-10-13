"use client";

import { useEffect, useRef } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";

import { useAccounts } from "@/features/accounts";
import { useCategories } from "@/features/categories";
import { useContacts } from "@/shared/contacts/use-contacts";
import { useAccountCategoryOptions } from "./use-account-category-options";
import { useTransactionDebtFields } from "./use-transaction-debt-fields";
import { useTransactionInvestmentFields } from "./use-transaction-investment-fields";
import type { TransactionFormOutput, TransactionFormValues } from "../schema";

type UseTransactionFormParams = {
  form: UseFormReturn<TransactionFormValues, unknown, TransactionFormOutput>;
  onSubmit: (values: TransactionFormOutput) => void;
  transactionId?: string;
};

export function useTransactionForm({
  form,
  onSubmit,
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

  const previousTypeRef = useRef(type);

  useEffect(() => {
    if (sourceIsDebt && type !== "transfer") {
      form.setValue("type", "transfer", { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceIsDebt]);

  useEffect(() => {
    const typeChanged = previousTypeRef.current !== type;
    previousTypeRef.current = type;
    if (typeChanged && type !== "transfer" && sourceIsDebt) {
      form.setValue("account_id", "", { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const { debtStatus, involvesDebtAccount, debtFieldsLocked, needsDebtAction, validateDebtFields } =
    useTransactionDebtFields({
      transactionId,
      contactId,
      type,
      sourceAccountType: sourceAccount?.account_type,
      destinationAccountType: destinationAccount?.account_type,
    });

  const { needsInvestmentFields, needsInvestmentSellFields, validateInvestmentFields } =
    useTransactionInvestmentFields({
      type,
      sourceAccountType: sourceAccount?.account_type,
      destinationAccountType: destinationAccount?.account_type,
    });

  const { accountOptions, categoryOptions, renderAccountOption } = useAccountCategoryOptions({
    accounts,
    categories,
    type,
    accountId,
    transferAccountId,
    categoryId,
  });

  function validateAllFields(values: TransactionFormOutput): string | null {
    return validateDebtFields(values) ?? validateInvestmentFields(values);
  }

  function errorFieldFor(values: TransactionFormOutput): "settle_debt_ids" | "contact_name" | "unit" {
    if (needsDebtAction && values.debt_action) return "settle_debt_ids";
    if (needsInvestmentFields) return "unit";
    return "contact_name";
  }

  function handleSubmit(values: TransactionFormOutput) {
    const error = validateAllFields(values);
    if (error) {
      form.setError(errorFieldFor(values), { message: error });
      return;
    }
    onSubmit(values);
  }

  return {
    type,
    accountId,
    debtStatus,
    involvesDebtAccount,
    debtFieldsLocked,
    needsDebtAction,
    needsInvestmentFields,
    needsInvestmentSellFields,
    accountOptions,
    categoryOptions,
    renderAccountOption,
    handleSubmit,
  };
}
