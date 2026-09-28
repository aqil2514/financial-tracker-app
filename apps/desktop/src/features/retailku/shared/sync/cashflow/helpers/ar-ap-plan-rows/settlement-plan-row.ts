import { basePlanRow } from "./base-plan-row";
import type { ArApRow } from "../extract-ar-ap-rows";
import type { ArApSyncPlanRow } from "../../types";

// Piutang aslinya (source_ref = row.settledReceivablePayableJournalItemId)
// SUDAH ketemu di debts lokal (paymentDebtId) — baris ini siap dicatat
// sebagai debt_payments baru, TIDAK menyentuh debts.amount.
export function settlementPlanRow(row: ArApRow, key: string, paymentDebtId: number): ArApSyncPlanRow {
  return { ...basePlanRow(row, key), willInsert: false, willInsertPayment: true, paymentDebtId, skipReason: null };
}
