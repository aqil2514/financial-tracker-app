"use client";

import { useDbMutation } from "@/hooks/use-db-mutation";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import type { Transaction } from "@/lib/db";
import { useContacts } from "@/shared/contacts/use-contacts";
import { useTransactionDebtStatus } from "@/shared/debts/use-transaction-debt-status";
import { useTransactionInvestmentPurchase } from "@/shared/investments/use-transaction-investment-purchase";
import { useTransactionInvestmentSale } from "@/shared/investments/use-transaction-investment-sale";
import { useTransactionLabels } from "@/shared/labels/use-transaction-labels";
import { transactionValuesFromRow } from "../../schema";
import type { UseUpdateTransactionBaseFormOptions } from "./type-base-form";
import { updateTransaction } from "../update-transaction";
import type { TransactionFormOutput } from "../../schema";

export function useUpdateTransactionBaseForm(
  transaction: Transaction,
  options: UseUpdateTransactionBaseFormOptions = {}
) {
  const { data: contacts } = useContacts();
  const contactName =
    contacts?.find((contact) => contact.id === transaction.contact_id)?.name ?? null;
  const { data: status } = useTransactionDebtStatus(transaction.id);
  const { data: investmentPurchase } = useTransactionInvestmentPurchase(transaction.id);
  const { data: investmentSale } = useTransactionInvestmentSale(transaction.id);
  const { data: labelNames } = useTransactionLabels(transaction.id);

  const isLoading =
    contacts === undefined ||
    status === undefined ||
    investmentPurchase === undefined ||
    investmentSale === undefined ||
    labelNames === undefined;

  const defaultValues = transactionValuesFromRow(transaction, {
    contactName,
    unit: investmentPurchase?.unit ?? investmentSale?.unit ?? null,
    pricePerUnit: investmentPurchase?.price_per_unit ?? investmentSale?.price_per_unit ?? null,
    investmentStatus: investmentPurchase?.status ?? investmentSale?.status ?? "pending",
    labelNames: labelNames ?? [],
  });

  const mutation = useDbMutation({
    mutationFn: async (values: TransactionFormOutput) => {
      if (status === undefined) {
        throw new Error("Status utang/piutang transaksi ini belum termuat, coba lagi.");
      }
      return updateTransaction(transaction, values, status);
    },
    invalidateKey: QUERY_DEPENDENCIES.transactions,
    successMessage: "Transaksi berhasil diperbarui",
    errorMessage: "Gagal memperbarui transaksi",
    onSuccess: () => options.onClosed?.(),
  });

  return {
    defaultValues,
    isLoading,
    onSubmit: mutation.mutate,
    isPending: mutation.isPending,
  };
}
