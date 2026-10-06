"use client";

import { UnsupportedAccountPairError, classifyAccountPair } from "@/shared/debts/classify-account-pair";
import type { Account } from "@/lib/db";

type UseTransactionInvestmentFieldsParams = {
  type: "income" | "expense" | "transfer";
  sourceAccountType: Account["account_type"] | undefined;
  destinationAccountType: Account["account_type"] | undefined;
};

/**
 * Field unit/harga per unit MUNCUL begitu transfer melibatkan akun
 * `account_type='investment'` — dua arah didukung (lihat
 * docs/concept/konsep-investasi.md):
 *
 * - `cash-investment` (beli): unit/harga OPSIONAL kalau status 'pending'
 *   (revisi 2026-10-06) — order beli yang masih pending (mis. reksadana
 *   di Bibit) belum tahu unit pastinya sampai settlement dikonfirmasi,
 *   boleh dikosongkan dulu, diisi belakangan lewat edit baris
 *   `investment_purchases`. WAJIB kalau status 'settled'.
 * - `investment-cash` (jual, 2026-10-07): unit/harga SELALU WAJIB — beda
 *   dari beli, jual tidak punya mekanisme "isi belakangan" (lihat
 *   docs/concept/konsep-investasi.md bagian "Input jual"). Field
 *   `amount` form JUGA otomatis dikunci (read-only) untuk arah ini —
 *   lihat `fields/investment-fields.tsx` dan `use-create-transaction.ts`
 *   soal kenapa (balance investment harus berkurang sebesar average
 *   cost, bukan nominal yang diketik user).
 */
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
      // UnsupportedAccountPairError sudah ditangani sbg pesan validasi di
      // useTransactionDebtFields (satu-satunya tempat yg menampilkannya ke
      // user) -- di sini cukup anggap bukan kombinasi investment.
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
