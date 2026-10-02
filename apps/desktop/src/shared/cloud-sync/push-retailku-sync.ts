/**
 * Push baris `transactions` hasil sync Retailku ke Worker -- dipanggil
 * `syncAll()` SETELAH sync sukses (all-or-nothing, jadi tidak ada baris
 * yg nanti di-rollback). Tanpa ini baris `source='retailku_sync'` cuma
 * sampai cloud lewat backfill manual, karena insert-nya bukan lewat hook
 * form (tempat `pushOnWrite` biasa dipanggil). Lihat
 * docs/todos/plan/cloud-sync-retailku-provenance-gap.md.
 *
 * `debts`/`debt_payments` Retailku TIDAK ikut -- Worker belum punya
 * endpoint push utk keduanya (diturunkan dari transaksi di sisi Worker).
 *
 * Non-blocking spt `pushOnWrite`: TIDAK pernah melempar ke caller.
 */

import { getDb } from "@/lib/db";
import { pushOnWrite } from "./push-on-write";

export async function pushRetailkuSyncedTransactions(sourceRefs: string[]): Promise<void> {
  if (sourceRefs.length === 0) return;
  try {
    const db = await getDb();
    const placeholders = sourceRefs.map((_, i) => `$${i + 1}`).join(", ");
    const rows = await db.select<{ id: string }[]>(
      `SELECT id FROM transactions WHERE source = 'retailku_sync' AND source_ref IN (${placeholders})`,
      sourceRefs
    );
    // Berurutan (bukan Promise.all) -- satu sync bisa ratusan baris,
    // jangan banjiri Worker dgn request paralel. pushOnWrite sendiri
    // sudah fallback ke antrian retry kalau gagal/offline.
    for (const row of rows) await pushOnWrite("transactions", row.id);
  } catch {
    // Best-effort: sisa baris bisa dikirim ulang lewat backfill.
  }
}
