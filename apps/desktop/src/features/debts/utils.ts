import type { DebtListRow } from "@/shared/debts/use-debts-list";

/** Baris `debts` PALING TUA (FIFO) ongoing milik satu kontak untuk satu
 * arah — konsisten dengan urutan alokasi otomatis `settleDebtsFifo`
 * (shared/debts/apply-debt-transaction.ts). Kontak dengan >1 piutang/
 * utang ongoing sekaligus tetap cuma dapat SATU tombol "Bayar", mengarah
 * ke yang tertua; sisanya dibayar lewat halaman /debts/receivables
 * /payables (tiap baris, bukan agregat per kontak). */
export function findOldestOngoing(
  debts: DebtListRow[] | undefined,
  contactId: number
): DebtListRow | undefined {
  return debts
    ?.filter((debt) => debt.contact_id === contactId && debt.status === "ongoing")
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)[0];
}
