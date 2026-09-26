import type { Db } from "../types";

/** Cek apakah baris piutang/utang ini (identitas: `sourceRef` =
 * `${journalItemId}:ar_ap`, journal item Retailku UNIK SELAMANYA)
 * SUDAH pernah disync — EXACT MATCH, BEDA dari `isPeriodSynced`
 * (cashflow biasa, prefix LIKE tanggal+akun) karena idempotency AR/AP
 * levelnya PER JURNAL ITEM individual, bukan per periode+akun. Lihat
 * docs/todos/plan/retailku-ar-ap-via-cashflow-detail.md. */
export async function isArApRowSynced(db: Db, sourceRef: string): Promise<boolean> {
  const rows = await db.select<{ found: number }[]>(
    "SELECT 1 AS found FROM transactions WHERE source = 'retailku_sync' AND source_ref = $1 LIMIT 1",
    [sourceRef]
  );
  return rows.length > 0;
}
