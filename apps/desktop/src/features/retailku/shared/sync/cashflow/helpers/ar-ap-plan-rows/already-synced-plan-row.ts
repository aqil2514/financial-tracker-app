import { basePlanRow } from "./base-plan-row";
import type { ArApRow } from "../extract-ar-ap-rows";
import type { ArApSyncPlanRow, RetailkuSyncFieldMappingRow } from "../../types";

export function alreadySyncedPlanRow(
  row: ArApRow,
  key: string,
  mapping: RetailkuSyncFieldMappingRow
): ArApSyncPlanRow {
  return {
    ...basePlanRow(row, key),
    willInsert: false,
    skipReason: "already-synced",
    debtLocalAccountId: mapping.localAccountId,
  };
}
