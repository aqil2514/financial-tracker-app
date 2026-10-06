"use client";

import { UnsupportedAccountPairError, classifyAccountPair } from "@/shared/debts/classify-account-pair";
import type { Account } from "@/lib/db";

type UseTransactionInvestmentFieldsParams = {
  type: "income" | "expense" | "transfer";
  sourceAccountType: Account["account_type"] | undefined;
  destinationAccountType: Account["account_type"] | undefined;
};

/**
 * Field unit/harga per unit WAJIB muncul begitu transfer tujuannya akun
 * `account_type='investment'` (lihat docs/concept/konsep-investasi.md
 * bagian "Unit dan harga per unit") — pola sama `useTransactionDebtFields`
 * tapi lebih sederhana (tidak ada deteksi arah ambigu seperti debt,
 * cuma satu kombinasi yang didukung: cash -> investment).
 */
export function useTransactionInvestmentFields({
  type,
  sourceAccountType,
  destinationAccountType,
}: UseTransactionInvestmentFieldsParams) {
  let pairIsCashInvestment = false;
  if (type === "transfer" && sourceAccountType != null && destinationAccountType != null) {
    try {
      pairIsCashInvestment = classifyAccountPair(sourceAccountType, destinationAccountType) === "cash-investment";
    } catch (err) {
      // UnsupportedAccountPairError sudah ditangani sbg pesan validasi di
      // useTransactionDebtFields (satu-satunya tempat yg menampilkannya ke
      // user) -- di sini cukup anggap bukan cash-investment.
      if (!(err instanceof UnsupportedAccountPairError)) throw err;
    }
  }

  const needsInvestmentFields = pairIsCashInvestment;

  function validateInvestmentFields(values: { unit: number | null; price_per_unit: number | null }): string | null {
    if (!needsInvestmentFields) return null;
    if (values.unit == null || values.unit <= 0) {
      return "Jumlah unit wajib diisi untuk transfer ke akun investasi";
    }
    if (values.price_per_unit == null || values.price_per_unit <= 0) {
      return "Harga per unit wajib diisi untuk transfer ke akun investasi";
    }
    return null;
  }

  return { needsInvestmentFields, validateInvestmentFields };
}
