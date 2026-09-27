import type { ArApRow } from "../extract-ar-ap-rows";
import type { ArApSyncPlanRow } from "../../types";

/** Akun debt lokal (piutang/utang) untuk arah ini belum dikonfigurasi user. */
export function debtAccountNotConfiguredPlanRow(arApRow: ArApRow): ArApSyncPlanRow {
  return { ...arApRow, willInsert: false, skipReason: "debt-account-not-configured" };
}
