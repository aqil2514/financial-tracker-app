"use client";

import { getDb, type Transaction } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { applyDebtTransactionEdit } from "@/shared/debts/apply-debt-transaction";
import { getTransactionDebtStatus } from "@/shared/debts/use-transaction-debt-status";
import type { DebtPaymentRow } from "@/shared/debts/use-debt-payments";
import { pushOnWrite, pushDeleteOnWrite } from "@/shared/cloud-sync/push-on-write";
import { editPaymentSchema, type EditPaymentFormOutput } from "./schema";

/**
 * Aksi cepat "Edit" per baris riwayat cicilan di `PaymentsList` — TIDAK
 * pindah ke halaman Transaksi (beda dari pola lama di
 * `detail-tab.tsx`/`?edit=<id>`), dialog ringkas langsung di tempat
 * karena field yang legal diubah dari sini SENGAJA dibatasi cuma
 * Nominal/Tanggal/Catatan (field "berbahaya" lain — akun, tipe, kontak —
 * TETAP terkunci ke nilai transaksi asli, sama seperti field locking di
 * `transaction-form.tsx` untuk role `payment`).
 *
 * Reuse PENUH `applyDebtTransactionEdit` yang sama dengan jalur edit
 * transaksi biasa (lihat debt-receivable-tracking.md, "Edit transaksi
 * yang sudah py debts terkait") — termasuk revert `debts.status`
 * `'paid'` -> `'ongoing'` kalau nominal baru tidak lagi menutupi sisa
 * (sudah diuji live, lihat catatan di dokumen yang sama). Cuma dipanggil
 * untuk `payment.transaction_id != null` — lihat guard tombol di
 * `payments-list.tsx` soal kenapa sebagian baris (data lama sebelum fix
 * non_cash) sengaja tidak punya aksi ini sama sekali.
 */
export function useEditPayment(payment: DebtPaymentRow, onSuccess?: () => void) {
  return useEntityForm({
    schema: editPaymentSchema,
    defaultValues: () => ({
      amount: payment.amount,
      date: payment.date,
      note: payment.note ?? "",
    }),
    resetOnOpen: true,
    mutationFn: async (values: EditPaymentFormOutput) => {
      const transactionId = payment.transaction_id as string;
      const db = await getDb();

      const rows = await db.select<Transaction[]>(
        "SELECT * FROM transactions WHERE id = $1",
        [transactionId]
      );
      const transaction = rows[0];
      if (!transaction) {
        throw new Error("Transaksi jejak cicilan ini tidak ditemukan.");
      }

      const status = await getTransactionDebtStatus(db, transactionId);
      if (status.role !== "payment") {
        throw new Error("Transaksi ini bukan jejak cicilan yang valid.");
      }

      await db.execute(
        "UPDATE transactions SET amount = $1, date = $2, note = $3 WHERE id = $4",
        [values.amount, values.date, values.note, transactionId]
      );

      // Konsisten dengan use-update-transaction.ts: cuma amount/akun/tipe/
      // kontak yang dianggap "berbahaya" (mempengaruhi perhitungan debt).
      // Akun/tipe/kontak TIDAK pernah diedit dari dialog ringkas ini,
      // jadi satu-satunya kandidat yang tersisa adalah amount. Tanggal
      // TIDAK dianggap berbahaya (sama seperti note/description).
      const dangerousFieldsChanged = values.amount !== transaction.amount;

      const touchedDebtRows = await applyDebtTransactionEdit({
        db,
        transactionId,
        type: transaction.type,
        accountId: transaction.account_id as string,
        transferAccountId: transaction.transfer_account_id,
        contactId: transaction.contact_id,
        amount: values.amount,
        date: values.date,
        debtAction: transaction.type === "transfer" ? "settlement" : null,
        settleDebtIds: transaction.type === "transfer" ? [status.debtId] : [],
        status,
        dangerousFieldsChanged,
      });

      for (const debtId of touchedDebtRows.debtIds) void pushOnWrite("debts", debtId);
      for (const debtPaymentId of touchedDebtRows.debtPaymentIds) void pushOnWrite("debt_payments", debtPaymentId);
      for (const debtId of touchedDebtRows.deletedDebtIds) void pushDeleteOnWrite("debts", debtId, {});
      for (const debtPaymentId of touchedDebtRows.deletedDebtPaymentIds)
        void pushDeleteOnWrite("debt_payments", debtPaymentId, {});
    },
    invalidateKey: QUERY_DEPENDENCIES.transactions,
    successMessage: "Cicilan berhasil diperbarui",
    errorMessage: "Gagal memperbarui cicilan",
    onSuccess,
  });
}
