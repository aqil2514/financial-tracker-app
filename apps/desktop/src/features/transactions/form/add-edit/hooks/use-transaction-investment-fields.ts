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

  const sourceIsInvestment = sourceAccountType === "investment";
  const needsInvestmentBuyFields = pairKind === "cash-investment";
  const needsInvestmentSellFields = pairKind === "investment-cash";
  const needsInvestmentDirectBuyFields = type === "income" && sourceIsInvestment;
  const needsInvestmentWriteOffFields = type === "expense" && sourceIsInvestment;
  const needsInvestmentFields =
    needsInvestmentBuyFields ||
    needsInvestmentSellFields ||
    needsInvestmentDirectBuyFields ||
    needsInvestmentWriteOffFields;

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
    if (needsInvestmentWriteOffFields) {
      if (values.unit == null || values.unit <= 0) {
        return "Jumlah unit wajib diisi untuk write-off investasi";
      }
      return null;
    }
    if (needsInvestmentDirectBuyFields) {
      if (values.unit == null || values.unit <= 0) {
        return "Jumlah unit wajib diisi";
      }
      if (values.price_per_unit == null) {
        return "Harga per unit wajib diisi";
      }
      if (values.price_per_unit <= 0) {
        return "Harga per unit harus lebih dari 0 — unit yang diterima tetap punya nilai pasar walau didapat gratis";
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

  return {
    needsInvestmentFields,
    needsInvestmentBuyFields,
    needsInvestmentSellFields,
    needsInvestmentDirectBuyFields,
    needsInvestmentWriteOffFields,
    validateInvestmentFields,
  };
}
