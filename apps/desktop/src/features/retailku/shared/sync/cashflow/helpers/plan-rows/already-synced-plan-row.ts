import type { CashflowSyncPlanRow } from "../../types";
import type { resolveMappedTotal } from "./resolve-mapped-total";

/** Tanggal+akun ini sudah pernah tersinkron sebelumnya (idempotency). */
export function alreadySyncedPlanRow(
  resolved: ReturnType<typeof resolveMappedTotal>,
  localAccountId: string
): CashflowSyncPlanRow {
  return {
    ...resolved,
    willInsert: false,
    skipReason: "already-synced",
    localAccountId,
  };
}
