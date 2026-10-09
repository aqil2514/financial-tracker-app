import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { pushOnWrite, detachLabelOnWrite } from "@/shared/cloud-sync/push-on-write";

type TransactionLabelRow = { id: string; label_id: string };

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
 */
export async function applyTransactionLabels(transactionId: string, labelIds: string[]): Promise<void> {
  const db = await getDb();
  const current = await db.select<TransactionLabelRow[]>(
    "SELECT id, label_id FROM transaction_labels WHERE transaction_id = $1 AND deleted_at IS NULL",
    [transactionId]
  );
  const currentByLabelId = new Map(current.map((row) => [row.label_id, row.id]));
  const nextLabelIds = new Set(labelIds);

  for (const labelId of labelIds) {
    if (currentByLabelId.has(labelId)) continue;
    const id = newId();
    await db.execute(
      "INSERT INTO transaction_labels (id, transaction_id, label_id) VALUES ($1, $2, $3)",
      [id, transactionId, labelId]
    );
    void pushOnWrite("transaction_labels", id);
  }

  for (const row of current) {
    if (nextLabelIds.has(row.label_id)) continue;
    await db.execute("UPDATE transaction_labels SET deleted_at = datetime('now') WHERE id = $1", [row.id]);
    void detachLabelOnWrite("transactions", transactionId, row.label_id);
  }
}
