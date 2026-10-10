import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { pushOnWrite, detachLabelOnWrite } from "@/shared/cloud-sync/push-on-write";

type TransactionLabelRow = { id: string; label_id: string; deleted_at: string | null };

/**
 * Samakan label yang nempel di 1 transaksi dengan `labelIds` yang baru
 * dipilih user -- attach yang belum ada, detach (soft-delete) yang sudah
 * tidak dipilih lagi. Dipanggil dari mutationFn create/update transaksi
 * SETELAH `resolveLabelIds` (nama -> id) dan SETELAH baris `transactions`
 * sendiri ter-INSERT/UPDATE (butuh `transactionId` yang sudah pasti ada).
 *
 * Diff (bukan "hapus semua lalu insert ulang") supaya baris junction yang
 * TIDAK berubah tidak perlu di-push ulang ke Worker -- penting utk create
 * (semua baru, tidak ada bedanya) tapi KRUSIAL utk update (biasanya
 * cuma 0-1 label yang berubah dari N yang sudah ada).
 *
 * SELECT sengaja TIDAK memfilter `deleted_at IS NULL`: UNIQUE(transaction_id,
 * label_id) tidak ikut menghitung `deleted_at`, jadi baris yang sudah
 * di-detach tetap memblokir INSERT baru. Re-attach = UPDATE deleted_at
 * = NULL pada baris lama (pola sama dgn attachLabel di Worker).
 */
export async function applyTransactionLabels(transactionId: string, labelIds: string[]): Promise<void> {
  const db = await getDb();
  const existing = await db.select<TransactionLabelRow[]>(
    "SELECT id, label_id, deleted_at FROM transaction_labels WHERE transaction_id = $1",
    [transactionId]
  );
  const existingByLabelId = new Map(existing.map((row) => [row.label_id, row]));
  const nextLabelIds = new Set(labelIds);

  for (const labelId of labelIds) {
    const row = existingByLabelId.get(labelId);
    if (row && row.deleted_at === null) continue;
    if (row) {
      await db.execute(
        "UPDATE transaction_labels SET deleted_at = NULL, updated_at = datetime('now') WHERE id = $1",
        [row.id]
      );
      void pushOnWrite("transaction_labels", row.id);
      continue;
    }
    const id = newId();
    await db.execute(
      "INSERT INTO transaction_labels (id, transaction_id, label_id) VALUES ($1, $2, $3)",
      [id, transactionId, labelId]
    );
    void pushOnWrite("transaction_labels", id);
  }

  for (const row of existing) {
    if (row.deleted_at !== null) continue;
    if (nextLabelIds.has(row.label_id)) continue;
    await db.execute("UPDATE transaction_labels SET deleted_at = datetime('now') WHERE id = $1", [row.id]);
    void detachLabelOnWrite("transactions", transactionId, row.label_id);
  }
}
