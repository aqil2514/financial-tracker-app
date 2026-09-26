import type { Db } from "../types";

/**
 * Cek apakah tanggal+akun ini SUDAH pernah disync sebelumnya — DI MODE
 * APA PUN, bukan exact-match `source_ref`. `source_ref` mode ringkas
 * ("date:accountId") dan mode detail ("date:accountId:sourceType") sama-
 * sama diawali prefix "date:accountId", jadi LIKE prefix menangkap
 * keduanya sebagai periode yang sama.
 *
 * Tanpa ini, ganti mode untuk periode yang sama menghasilkan `source_ref`
 * berbeda -> idempotency check exact-match lolos -> insert dobel (bug
 * ditemukan live 2026-09-22, lihat
 * docs/handover-session/2026-09-22-transactions-refactor-dan-retailku-duplikasi.md).
 */
export async function isPeriodSynced(db: Db, date: string, retailkuAccountId: string): Promise<boolean> {
  const prefix = `${date}:${retailkuAccountId}`;
  const rows = await db.select<{ found: number }[]>(
    "SELECT 1 AS found FROM transactions WHERE source = 'retailku_sync' AND (source_ref = $1 OR source_ref LIKE $1 || ':%') LIMIT 1",
    [prefix]
  );
  return rows.length > 0;
}
