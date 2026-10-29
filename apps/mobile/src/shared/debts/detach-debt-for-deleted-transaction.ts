import { getTransactionDebtStatus } from "./transaction-debt-status";
import type { Db } from "./types";

export type DeletedTransactionDebtInfo =
  | { role: "none" }
  | { role: "payment"; debtId: string }
  | { role: "principal"; debtId: string; hadPayments: boolean };

// Dipanggil SEBELUM baris transactions itu sendiri dihapus oleh caller
// (use-case delete transaction umum) — fungsi ini cuma membersihkan sisi
// debt. role: 'principal' TIDAK menghapus baris debts, cuma SET
// transaction_id = NULL — nominal dan status debt tetap sama persis,
// cuma kehilangan tautan "lahir dari transaksi mana" (konsisten aturan
// konsep: nominal piutang/utang tidak boleh hilang gara-gara transaksi
// pokoknya dihapus).
export async function detachDebtForDeletedTransaction(
  db: Db,
  transactionId: string
): Promise<DeletedTransactionDebtInfo> {
  const status = await getTransactionDebtStatus(db, transactionId);

  if (status.role === "none") {
    return { role: "none" };
  }

  if (status.role === "payment") {
    await db.runAsync("DELETE FROM debt_payments WHERE id = ?", [status.debtPaymentId]);
    // status IN ('paid', 'written_off') — bukan cuma 'paid'. Payment
    // penutup write-off (writeOffDebt) juga baris debt_payments biasa;
    // kalau transaksi penutup itu dihapus dan sisa jadi > 0 lagi, debt
    // yang tadinya 'written_off' harus ikut turun ke 'ongoing', jangan
    // dibiarkan nyangkut "Dihapuskan" dengan remaining > 0.
    await db.runAsync(
      `UPDATE debts SET status = 'ongoing'
       WHERE id = ? AND status IN ('paid', 'written_off') AND amount > COALESCE(
         (SELECT SUM(amount) FROM debt_payments WHERE debt_payments.debt_id = debts.id),
         0
       )`,
      [status.debtId]
    );
    return { role: "payment", debtId: status.debtId };
  }

  // status.role === "principal"
  await db.runAsync("UPDATE debts SET transaction_id = NULL WHERE id = ?", [status.debtId]);
  return { role: "principal", debtId: status.debtId, hadPayments: status.hasPayments };
}
