import { basePlanRow } from "./base-plan-row";
import type { ArApRow } from "../extract-ar-ap-rows";
import type { ArApSyncPlanRow } from "../../types";

// row.isReversed membedakan 2 kasus yang SEBELUMNYA digabung jadi 1
// skipReason (bug: sourceType sendirian tidak cukup membedakan
// reversal dari piutang/utang baru — lihat get-cfr-detail.helper.ts
// sisi retailku). "reversal" = piutang/utang batal, tidak pernah jadi
// kas, aman diskip permanen. "settlement-not-supported" = pelunasan
// ASLI (kas benar-benar berpindah) tapi representasinya di debts belum
// digarap (butuh link ke debts asal, belum ada field itu) — scope sesi
// depan.
export function negativeAmountPlanRow(row: ArApRow, key: string): ArApSyncPlanRow {
  const skipReason = row.isReversed ? "reversal" : "settlement-not-supported";
  return { ...basePlanRow(row, key), willInsert: false, skipReason };
}
