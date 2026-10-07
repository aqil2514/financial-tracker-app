"use client";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { dependentKeysOf } from "@/lib/query-dependencies";
import { pushDeleteOnWrite } from "@/shared/cloud-sync/push-on-write";
import { deletePendingInvestmentSale } from "./apply-sell-investment-transaction";

/**
 * Hapus satu baris `investment_sales` yang masih `pending` dari
 * `SalesHistoryTable` — BUKAN lewat hapus transaksi (baris pending TIDAK
 * punya transaksi apa pun, lihat apply-sell-investment-transaction.ts
 * applySellInvestmentTransaction). `useDbMutation` dipakai langsung
 * (bukan `useEntityForm`) karena aksi ini tidak punya form — cuma
 * konfirmasi lewat `ConfirmDeleteButton`.
 */
export function useDeletePendingInvestmentSale() {
  return useDbMutation({
    mutationFn: async (saleId: string) => {
      // Push SEBELUM hard-delete lokal -- pola sama tabel lain (lihat
      // push-on-write.ts).
      await pushDeleteOnWrite("investment_sales", saleId, {});

      const db = await getDb();
      await deletePendingInvestmentSale(db, saleId);
    },
    invalidateKey: dependentKeysOf("transactions"),
    successMessage: "Penjualan investasi (pending) berhasil dihapus",
    errorMessage: "Gagal menghapus penjualan investasi",
  });
}
