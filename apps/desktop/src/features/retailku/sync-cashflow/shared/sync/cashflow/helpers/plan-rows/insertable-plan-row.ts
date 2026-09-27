import type { CashflowSyncPlanRow } from "../../types";
import type { resolveMappedTotal } from "./resolve-mapped-total";

/** Lolos semua pengecekan — baris ini akan di-insert saat sync jalan. */
export function insertablePlanRow(
  resolved: ReturnType<typeof resolveMappedTotal>,
  localAccountId: number
): CashflowSyncPlanRow {
  return {
    ...resolved,
    willInsert: true,
    skipReason: null,
    localAccountId,
  };
}
