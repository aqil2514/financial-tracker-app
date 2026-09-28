import { basePlanRow } from "./base-plan-row";
import type { ArApRow } from "../extract-ar-ap-rows";
import type { ArApSyncPlanRow } from "../../types";

// row.settledReceivablePayableJournalItemId ADA (link ke piutang asli
// diketahui), TAPI piutang itu BELUM pernah tersinkron ke debts lokal
// (source_ref-nya tidak ketemu) — tidak ada yang bisa dicicil. BEDA
// dari settlement-not-supported (link-nya sendiri tidak diketahui).
export function settledDebtNotFoundPlanRow(row: ArApRow, key: string): ArApSyncPlanRow {
  return { ...basePlanRow(row, key), willInsert: false, skipReason: "settled-debt-not-found" };
}
