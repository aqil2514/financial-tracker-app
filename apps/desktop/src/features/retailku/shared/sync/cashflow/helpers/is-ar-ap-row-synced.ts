import type { Db } from "../types";

// Exact match by sourceRef (1 jurnal item = 1 kemungkinan baris debts) —
// beda dari isPeriodSynced yang prefix-match tanggal+akun (agregasi per hari).
// Return id (bukan cuma boolean) supaya mode "overwrite" tahu baris debts
// mana yang harus di-UPDATE.
export async function findSyncedArApDebtId(db: Db, sourceRef: string): Promise<string | null> {
  const rows = await db.select<{ id: string }[]>(
    "SELECT id FROM debts WHERE source_ref = $1 LIMIT 1",
    [sourceRef]
  );
  return rows[0]?.id ?? null;
}
