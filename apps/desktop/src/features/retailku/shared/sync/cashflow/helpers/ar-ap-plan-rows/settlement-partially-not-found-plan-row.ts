import { basePlanRow } from "./base-plan-row";
import type { ArApRow } from "../extract-ar-ap-rows";
import type { ArApSyncPlanRow } from "../../types";

// Kebijakan all-or-nothing: SATU SAJA debtId di
// row.settledReceivablePayableJournalItemIds tidak ketemu di debts
// lokal -> skip SELURUH baris, TIDAK proses partial (menghindari
// alokasi sebagian yang membingungkan/tidak lengkap).
export function settlementPartiallyNotFoundPlanRow(row: ArApRow, key: string): ArApSyncPlanRow {
  return { ...basePlanRow(row, key), willInsert: false, skipReason: "settlement-partially-not-found" };
}
