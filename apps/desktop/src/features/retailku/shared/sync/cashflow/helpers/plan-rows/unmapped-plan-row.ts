import type { AggregatedTotal, CashflowSyncPlanRow } from "../../types";

/** `key` belum ada baris `retailku_sync_field_mapping` — belum di-mapping user. */
export function unmappedPlanRow(total: AggregatedTotal): CashflowSyncPlanRow {
  return {
    ...total,
    categoryId: null,
    description: null,
    willInsert: false,
    skipReason: "unmapped-account",
    localAccountId: null,
  };
}
