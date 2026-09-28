import { isArApRowSynced } from "../is-ar-ap-row-synced";
import type { ArApRow } from "../extract-ar-ap-rows";
import type { ArApSyncPlanRow, Db } from "../../types";

/** Akun debt lokal sudah dikonfigurasi — tinggal cek idempotency (per
 * jurnal item individual, lihat `isArApRowSynced`). */
export async function checkedArApPlanRow(db: Db, arApRow: ArApRow): Promise<ArApSyncPlanRow> {
  const alreadySynced = await isArApRowSynced(db, arApRow.sourceRef);
  return {
    ...arApRow,
    willInsert: !alreadySynced,
    skipReason: alreadySynced ? "already-synced" : null,
  };
}
