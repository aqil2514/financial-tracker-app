import { basePlanRow } from "./base-plan-row";
import type { ArApRow } from "../extract-ar-ap-rows";
import type { ArApSyncPlanRow } from "../../types";

// SEMUA debts di row.settledReceivablePayableJournalItemIds SUDAH
// ketemu di lokal (all-or-nothing, dicek di index.ts) — siap dicatat
// sebagai BANYAK debt_payments sekaligus, TIDAK menyentuh debts.amount.
export function settlementBatchPlanRow(
  row: ArApRow,
  key: string,
  allocations: { debtId: number; amount: number }[]
): ArApSyncPlanRow {
  return { ...basePlanRow(row, key), willInsert: false, willInsertPayments: allocations, skipReason: null };
}
