import { classifyAccountPair, UnsupportedAccountPairError, type AccountPairKind } from "@/shared/debts";

export type AccountDebtInfo = {
  accountType: "cash" | "debt";
  direction: "receivable" | "payable" | null;
};

export type OngoingDebt = {
  id: string;
  amount: number;
  date: string;
  remaining: number;
};

export interface DerivedDebtFields {
  involvesDebtAccount: boolean;
  needsDebtAction: boolean;
  settlementDirection: "receivable" | "payable" | null;
  isDebtDebtTransfer: boolean;
  unsupportedPairMessage: string | null;
}

// Logic murni di balik use-transaction-debt-fields.ts — dipisah dari
// hook (yang urusannya cuma fetch sourceInfo/destinationInfo dari DB)
// supaya testable tanpa React/useDatabase. Pola sama seperti
// use-transaction-debt-fields.ts desktop, versi CREATE saja (belum ada
// debtFieldsLocked — menyusul sekalian guard edit/delete).
export function deriveDebtFields(
  type: "income" | "expense" | "transfer",
  sourceInfo: AccountDebtInfo | null,
  destinationInfo: AccountDebtInfo | null
): DerivedDebtFields {
  let pairKind: AccountPairKind | null = null;
  let unsupportedPairMessage: string | null = null;
  if (type === "transfer" && sourceInfo != null && destinationInfo != null) {
    try {
      pairKind = classifyAccountPair(sourceInfo.accountType, destinationInfo.accountType);
    } catch (err) {
      if (err instanceof UnsupportedAccountPairError) {
        unsupportedPairMessage = err.message;
      } else {
        throw err;
      }
    }
  }

  const sourceIsDebt = sourceInfo?.accountType === "debt";
  const destinationIsDebt = destinationInfo?.accountType === "debt";
  const isDebtDebtTransfer = pairKind === "debt-debt";
  const involvesDebtAccount =
    type === "transfer" ? (sourceIsDebt || destinationIsDebt) && !isDebtDebtTransfer : sourceIsDebt;

  const settlementDirection: "receivable" | "payable" | null =
    type === "transfer"
      ? pairKind === "cash-debt" && destinationInfo?.direction === "payable"
        ? "payable"
        : pairKind === "debt-cash" && sourceInfo?.direction === "receivable"
          ? "receivable"
          : null
      : type === "income" && sourceInfo?.direction === "payable"
        ? "payable"
        : type === "expense" && sourceInfo?.direction === "receivable"
          ? "receivable"
          : null;

  return {
    involvesDebtAccount,
    needsDebtAction: settlementDirection != null,
    settlementDirection,
    isDebtDebtTransfer,
    unsupportedPairMessage,
  };
}

export function validateDebtFields(
  derived: DerivedDebtFields,
  ongoingDebts: OngoingDebt[],
  values: { amount: number; contact_id: string | null; settle_debt_ids: string[] }
): string | null {
  if (derived.unsupportedPairMessage) return derived.unsupportedPairMessage;
  if (derived.involvesDebtAccount && !values.contact_id) {
    return "Kontak wajib diisi untuk transaksi yang melibatkan akun utang piutang";
  }
  if (derived.needsDebtAction) {
    if (values.settle_debt_ids.length === 0) {
      return "Pilih minimal satu piutang/utang yang dilunasi";
    }
    const totalRemaining = ongoingDebts
      .filter((debt) => values.settle_debt_ids.includes(debt.id))
      .reduce((sum, debt) => sum + debt.remaining, 0);
    if (values.amount > totalRemaining) {
      return "Nominal melebihi total sisa yang dipilih — catat kelebihannya sebagai transaksi terpisah";
    }
  }
  return null;
}
