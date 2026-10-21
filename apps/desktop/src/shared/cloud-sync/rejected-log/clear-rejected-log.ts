import { getDb } from "@/lib/db";
import type { QueueableTable } from "../push-queue";

// Dipanggil tiap kali push ke baris yang sama SUKSES (status "ok"/
// "ignored") -- baris yang pernah ditolak tapi sekarang berhasil
// (mis. setelah user edit ulang datanya) tidak relevan lagi di log.
export async function clearRejectedLog(table: QueueableTable, id: string) {
  const db = await getDb();
  await db.execute("DELETE FROM cloud_sync_rejected_log WHERE table_name = $1 AND row_id = $2", [table, id]);
}
