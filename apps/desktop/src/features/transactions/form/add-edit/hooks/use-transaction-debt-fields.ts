"use client";

import {
  classifyAccountPair,
  UnsupportedAccountPairError,
  type AccountPairKind,
} from "@/shared/debts/classify-account-pair";
import { useTransactionDebtStatus } from "@/shared/debts/use-transaction-debt-status";
import { useOngoingDebts } from "@/shared/debts/use-ongoing-debts";
import type { Account } from "@/lib/db";
import type { TransactionFormOutput } from "../schema";

type UseTransactionDebtFieldsParams = {
  transactionId: string | undefined;
  contactId: string | null;
  type: "income" | "expense" | "transfer";
  sourceAccountType: Account["account_type"] | undefined;
  destinationAccountType: Account["account_type"] | undefined;
  sourceDebtDirection: "receivable" | "payable" | null | undefined;
  destinationDebtDirection: "receivable" | "payable" | null | undefined;
};

export function useTransactionDebtFields({
  transactionId,
  contactId,
  type,
  sourceAccountType,
  destinationAccountType,
  sourceDebtDirection,
  destinationDebtDirection,
}: UseTransactionDebtFieldsParams) {
  const { data: debtStatus } = useTransactionDebtStatus(transactionId);

  let pairKind: AccountPairKind | null = null;
  let unsupportedPairMessage: string | null = null;
  if (type === "transfer" && sourceAccountType != null && destinationAccountType != null) {
    try {
      pairKind = classifyAccountPair(sourceAccountType, destinationAccountType);
    } catch (err) {
      if (err instanceof UnsupportedAccountPairError) {
        unsupportedPairMessage = err.message;
      } else {
        throw err;
      }
    }
  }

  const sourceIsDebt = sourceAccountType === "debt";
  const destinationIsDebt = destinationAccountType === "debt";
  const isDebtDebtTransfer = pairKind === "debt-debt";
  const involvesDebtAccount =
    type === "transfer" ? (sourceIsDebt || destinationIsDebt) && !isDebtDebtTransfer : sourceIsDebt;

  const debtFieldsLocked = debtStatus?.role === "principal" && debtStatus.hasPayments;

  const settlementDirection: "receivable" | "payable" | null =
    type === "transfer"
      ? pairKind === "cash-debt" && destinationDebtDirection === "payable"
        ? "payable"
        : pairKind === "debt-cash" && sourceDebtDirection === "receivable"
          ? "receivable"
          : null
      : type === "income" && sourceDebtDirection === "payable"
        ? "payable"
        : type === "expense" && sourceDebtDirection === "receivable"
          ? "receivable"
          : null;

  const needsDebtAction = !debtFieldsLocked && settlementDirection != null;

  const { data: ongoingDebts } = useOngoingDebts(contactId, settlementDirection ?? "receivable", {
    excludeDebtId: debtStatus?.role === "payment" ? debtStatus.debtId : undefined,
    excludeTransactionId: debtStatus?.role === "payment" ? transactionId : undefined,
    excludePrincipalDebtId: debtStatus?.role === "principal" ? debtStatus.debtId : undefined,
  });

  function validateDebtFields(values: TransactionFormOutput): string | null {
    if (debtFieldsLocked) return null;
    if (unsupportedPairMessage) return unsupportedPairMessage;
    if (involvesDebtAccount && !values.contact_name?.trim()) {
      return "Nama kontak wajib diisi untuk transaksi yang melibatkan akun utang piutang";
    }
    if (needsDebtAction) {
      if (values.settle_debt_ids.length === 0) {
        return "Pilih minimal satu piutang/utang yang dilunasi";
      }
      const totalRemaining = (ongoingDebts ?? [])
        .filter((debt) => values.settle_debt_ids.includes(String(debt.id)))
        .reduce((sum, debt) => sum + debt.remaining, 0);
      if (values.amount > totalRemaining) {
        return "Nominal melebihi total sisa yang dipilih — catat kelebihannya sebagai transaksi terpisah";
      }
    }
    return null;
  }

  return {
    debtStatus,
    involvesDebtAccount,
    debtFieldsLocked,
    needsDebtAction,
    settlementDirection,
    ongoingDebts,
    isDebtDebtTransfer,
    validateDebtFields,
  };
}
