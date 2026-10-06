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
  onSubmitAndContinue?: (values: TransactionFormOutput) => void;
  transactionId?: string;
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

  // Akun `debt` cuma bisa disentuh lewat transfer (lihat
  // apply-debt-transaction.ts — dipilih di income/expense akan
  // "tersimpan" tapi TIDAK PERNAH tercatat sebagai piutang/utang, bug
  // senyap). Dua aturan UX saling melengkapi:
  // 1. Pilih akun debt sbg "Akun" -> tipe otomatis dipaksa ke transfer.
  // 2. User ganti tipe MENJAUH dari transfer sementara akun yang
  //    sedang terpilih bertipe debt -> akun itu dikosongkan lagi
  //    (bukan reset SETIAP kali tipe berubah, supaya efek 1 tidak
  //    saling menganulir efek ini di render yang sama).
  const previousTypeRef = useRef(type);

  useEffect(() => {
    if (sourceIsDebt && type !== "transfer") {
      form.setValue("type", "transfer", { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reaksi ke accountId (via sourceIsDebt), `type`/`form` sengaja tidak di deps supaya tidak retrigger tiap render
  }, [sourceIsDebt]);

  useEffect(() => {
    const typeChanged = previousTypeRef.current !== type;
    previousTypeRef.current = type;
    if (typeChanged && type !== "transfer" && sourceIsDebt) {
      form.setValue("account_id", "", { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reaksi ke perubahan `type` saja, `sourceIsDebt`/`form` dibaca dari closure terbaru tanpa perlu retrigger sendiri
  }, [type]);

  const { debtStatus, involvesDebtAccount, debtFieldsLocked, needsDebtAction, validateDebtFields } =
    useTransactionDebtFields({
      transactionId,
      contactId,
      type,
      sourceAccountType: sourceAccount?.account_type,
      destinationAccountType: destinationAccount?.account_type,
    });

  const { needsInvestmentFields, validateInvestmentFields } = useTransactionInvestmentFields({
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

  function handleSubmit(values: TransactionFormOutput) {
    const error = validateAllFields(values);
    if (error) {
      form.setError(needsDebtAction && values.debt_action ? "settle_debt_ids" : "contact_name", {
        message: error,
      });
      return;
    }
    onSubmit(values);
  }

  function handleSubmitAndContinue(values: TransactionFormOutput) {
    const error = validateAllFields(values);
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
    needsInvestmentFields,
    accountOptions,
    categoryOptions,
    renderAccountOption,
    handleSubmit,
    handleSubmitAndContinue,
  };
}
