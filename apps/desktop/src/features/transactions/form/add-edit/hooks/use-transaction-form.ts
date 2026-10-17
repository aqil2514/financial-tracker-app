"use client";

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
  const {
    debtStatus,
    involvesDebtAccount,
    debtFieldsLocked,
    needsDebtAction,
    settlementDirection,
    ongoingDebts,
    isDebtDebtTransfer,
    validateDebtFields,
  } = useTransactionDebtFields({
      transactionId,
      contactId,
      type,
      sourceAccountType: sourceAccount?.account_type,
      destinationAccountType: destinationAccount?.account_type,
      sourceDebtDirection: sourceAccount?.debt_direction,
      destinationDebtDirection: destinationAccount?.debt_direction,
    });

  const {
    needsInvestmentFields,
    needsInvestmentSellFields,
    needsInvestmentDirectBuyFields,
    needsInvestmentWriteOffFields,
    validateInvestmentFields,
  } = useTransactionInvestmentFields({
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
    if (values.amount <= 0 && !needsInvestmentDirectBuyFields) {
      return "Nominal harus lebih dari 0";
    }
    return validateDebtFields(values) ?? validateInvestmentFields(values);
  }

  function errorFieldFor(values: TransactionFormOutput): "amount" | "settle_debt_ids" | "contact_name" | "unit" {
    if (values.amount <= 0 && !needsInvestmentDirectBuyFields) return "amount";
    if (needsDebtAction) return "settle_debt_ids";
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
    settlementDirection,
    ongoingDebts,
    isDebtDebtTransfer,
    needsInvestmentFields,
    needsInvestmentSellFields,
    needsInvestmentDirectBuyFields,
    needsInvestmentWriteOffFields,
    accountOptions,
    categoryOptions,
    renderAccountOption,
    handleSubmit,
  };
}
