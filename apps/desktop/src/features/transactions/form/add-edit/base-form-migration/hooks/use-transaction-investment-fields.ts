"use client";

import { UnsupportedAccountPairError, classifyAccountPair } from "@/shared/debts/classify-account-pair";
import type { Account } from "@/lib/db";

type UseTransactionInvestmentFieldsParams = {
  type: "income" | "expense" | "transfer";
  sourceAccountType: Account["account_type"] | undefined;
  destinationAccountType: Account["account_type"] | undefined;
};

export function useTransactionInvestmentFields({
  type,
  sourceAccountType,
  destinationAccountType,
}: UseTransactionInvestmentFieldsParams) {
  let pairKind: "cash-investment" | "investment-cash" | null = null;
  if (type === "transfer" && sourceAccountType != null && destinationAccountType != null) {
    try {
      const kind = classifyAccountPair(sourceAccountType, destinationAccountType);
      if (kind === "cash-investment" || kind === "investment-cash") pairKind = kind;
    } catch (err) {
      if (!(err instanceof UnsupportedAccountPairError)) throw err;
    }
  }

  const needsInvestmentBuyFields = pairKind === "cash-investment";
  const needsInvestmentSellFields = pairKind === "investment-cash";
  const needsInvestmentFields = needsInvestmentBuyFields || needsInvestmentSellFields;

  function validateInvestmentFields(values: {
    unit: number | null;
    price_per_unit: number | null;
    investment_status: "pending" | "settled" | null;
  }): string | null {
    if (needsInvestmentSellFields) {
      if (values.unit == null || values.unit <= 0) {
        return "Jumlah unit wajib diisi untuk penjualan investasi";
      }
      if (values.price_per_unit == null || values.price_per_unit <= 0) {
        return "Harga jual per unit wajib diisi untuk penjualan investasi";
      }
      return null;
    }
    if (!needsInvestmentBuyFields || values.investment_status !== "settled") return null;
    if (values.unit == null || values.unit <= 0) {
      return "Jumlah unit wajib diisi untuk status Settled";
    }
    if (values.price_per_unit == null || values.price_per_unit <= 0) {
      return "Harga per unit wajib diisi untuk status Settled";
    }
    return null;
  }

  return { needsInvestmentFields, needsInvestmentBuyFields, needsInvestmentSellFields, validateInvestmentFields };
}
