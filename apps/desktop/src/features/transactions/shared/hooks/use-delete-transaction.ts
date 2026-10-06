"use client";

import { toast } from "sonner";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { pushDeleteTransactionOnWrite } from "@/shared/cloud-sync/push-on-write";
import { detachDebtForDeletedTransaction, type DeletedTransactionDebtInfo } from "@/shared/debts/apply-debt-transaction";
import { detachInvestmentPurchaseForDeletedTransaction } from "@/shared/investments/apply-investment-transaction";

// Pesan informatif SETELAH delete berhasil -- dialog konfirmasi tetap
// generik ("Hapus transaksi ini?"), toast tambahan ini muncul begitu
// ketahuan transaksi yg baru dihapus ternyata pokok/cicilan piutang
// (keputusan 2026-10-03, lihat cloud-sync.md "DELETE /transactions/:id").
// Berbasis status LOKAL (SQLite PC), BUKAN response Worker -- supaya
// tetap muncul independen dari cloud sync aktif/tidak (gap yg sempat
// kelewat: awalnya numpang ke debtInfo Worker, berarti toast TIDAK
// PERNAH muncul kalau cloud sync OFF/offline).
function describeDebtInfo(debtInfo: DeletedTransactionDebtInfo): string | null {
  if (debtInfo.role === "none") return null;
  if (debtInfo.role === "payment") {
    return "Transaksi ini adalah pelunasan piutang/utang — pelunasannya ikut dibatalkan.";
  }
  return "Transaksi ini adalah pokok piutang/utang — piutang/utangnya tetap ada, tapi kehilangan jejak transaksi asal.";
}

export function useDeleteTransaction() {
  return useDbMutation({
    mutationFn: async (id: string): Promise<DeletedTransactionDebtInfo> => {
      // Push SEBELUM hard-delete lokal, pola sama 4 tabel lain
      // (use-delete-contact.ts dst) -- gagal/offline TIDAK memblokir
      // delete lokal (fungsi ini sendiri sudah dijamin tidak pernah
      // throw, masuk antrian retry kalau perlu). Hasilnya (debtInfo
      // versi Worker) TIDAK dipakai utk toast di sini -- lihat komentar
      // describeDebtInfo soal kenapa sumbernya harus status LOKAL.
      await pushDeleteTransactionOnWrite(id);

      const db = await getDb();
      const debtInfo = await detachDebtForDeletedTransaction(db, id);
      // Beda dari debts (transaction_id SET NULL, principal tetap ada) --
      // investment_purchases TIDAK punya makna tanpa transaksi asalnya
      // (bukan tumpuan accounts.balance), jadi dihapus total alih-alih
      // dibiarkan yatim. Lihat apply-investment-transaction.ts.
      await detachInvestmentPurchaseForDeletedTransaction(db, id);
      await db.execute("DELETE FROM transactions WHERE id = $1", [id]);

      return debtInfo;
    },
    onSuccess: (debtInfo) => {
      const message = describeDebtInfo(debtInfo);
      if (message) toast.info(message);
    },
    invalidateKey: QUERY_DEPENDENCIES.transactions,
    successMessage: "Transaksi berhasil dihapus",
    errorMessage: "Gagal menghapus transaksi",
  });
}
