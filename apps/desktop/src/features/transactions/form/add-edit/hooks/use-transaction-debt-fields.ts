"use client";

import { useTransactionDebtStatus } from "@/shared/debts/use-transaction-debt-status";
import { useOngoingDebts } from "@/shared/debts/use-ongoing-debts";
import type { TransactionFormOutput } from "../schema";

type UseTransactionDebtFieldsParams = {
  transactionId: number | undefined;
  contactId: number | null;
  type: "income" | "expense" | "transfer";
  sourceIsDebt: boolean;
  destinationIsDebt: boolean;
};

/**
 * Semua state dan validasi terkait field utang-piutang di form transaksi
 * — dikumpulkan di sini karena saling bergantung (debtStatus menentukan
 * apakah field dikunci DAN piutang mana yang tetap muncul di checklist,
 * lihat komentar `excludeDebtId`/`excludeTransactionId` di bawah).
 */
export function useTransactionDebtFields({
  transactionId,
  contactId,
  type,
  sourceIsDebt,
  destinationIsDebt,
}: UseTransactionDebtFieldsParams) {
  // debtStatus dipakai DUA kali: mengunci field berbahaya (di bawah) DAN
  // memastikan piutang yang jadi target pembayaran transaksi ini SENDIRI
  // tetap muncul di checklist DebtActionField meski statusnya sudah
  // 'paid' (lihat use-ongoing-debts.ts) — tanpa ini, edit transaksi yang
  // tadinya melunasi PENUH sebuah piutang tidak bisa memilih ulang
  // piutang yang sama di form.
  const { data: debtStatus } = useTransactionDebtStatus(transactionId);
  const { data: ongoingDebts } = useOngoingDebts(contactId, {
    excludeDebtId: debtStatus?.role === "payment" ? debtStatus.debtId : undefined,
    excludeTransactionId: debtStatus?.role === "payment" ? transactionId : undefined,
  });

  const involvesDebtAccount = sourceIsDebt || destinationIsDebt;

  // Transaksi (mode edit) yang berperan sebagai piutang INDUK dan SUDAH
  // menerima cicilan dari transaksi LAIN — field berbahaya (kontak,
  // nominal, akun, aksi debt) dikunci read-only, karena merevisinya
  // butuh recreate yang akan menghapus cicilan itu lewat CASCADE. Lihat
  // apply-debt-transaction.ts (applyDebtTransactionEdit) dan "Edit
  // transaksi yang sudah py debts terkait" di debt-receivable-tracking.md.
  // Transaksi yang berperan sebagai PEMBAYARAN (bukan induk), atau induk
  // yang belum py cicilan, TETAP bebas diedit — recreate-nya aman.
  const debtFieldsLocked = debtStatus?.role === "principal" && debtStatus.hasPayments;

  // debt -> cash: arah transfer semata ambigu (pelunasan piutang existing
  // vs utang baru) — lihat "Deteksi otomatis debts dari transfer" di
  // debt-receivable-tracking.md. debt -> debt sengaja TIDAK termasuk
  // (di luar scope, tidak trigger apa pun).
  const needsDebtAction =
    !debtFieldsLocked && type === "transfer" && sourceIsDebt && !destinationIsDebt;

  function validateDebtFields(values: TransactionFormOutput): string | null {
    if (debtFieldsLocked) return null;
    if (involvesDebtAccount && !values.contact_name?.trim()) {
      return "Nama kontak wajib diisi untuk transaksi yang melibatkan akun utang piutang";
    }
    if (needsDebtAction) {
      if (!values.debt_action) {
        return "Pilih dulu apakah ini pelunasan piutang atau utang baru";
      }
      if (values.debt_action === "settlement") {
        if (values.settle_debt_ids.length === 0) {
          return "Pilih minimal satu piutang yang dilunasi";
        }
        // Konsisten dengan pola pembayaran nyata yang ditemukan di data
        // ("Kak Ipit Paylater" — pokok & kelebihan SELALU 2 transaksi
        // terpisah) — lihat "Update besar" poin 5 di
        // debt-receivable-tracking.md. Tanpa validasi ini, kelebihan
        // bayar hilang begitu saja (settleDebtsFifo cuma mengalokasikan
        // sampai piutang yang dicentang habis, sisanya dibuang).
        const totalRemaining = (ongoingDebts ?? [])
          .filter((debt) => values.settle_debt_ids.includes(String(debt.id)))
          .reduce((sum, debt) => sum + debt.remaining, 0);
        if (values.amount > totalRemaining) {
          return "Nominal melebihi total sisa piutang yang dipilih — catat kelebihannya sebagai transaksi terpisah";
        }
      }
    }
    return null;
  }

  return {
    debtStatus,
    involvesDebtAccount,
    debtFieldsLocked,
    needsDebtAction,
    validateDebtFields,
  };
}
