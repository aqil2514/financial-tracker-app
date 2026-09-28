import { basePlanRow } from "./base-plan-row";
import type { ArApRow } from "../extract-ar-ap-rows";
import type { ArApSyncPlanRow, RetailkuSyncFieldMappingRow } from "../../types";

export function updatablePlanRow(
  row: ArApRow,
  key: string,
  mapping: RetailkuSyncFieldMappingRow,
  existingDebtId: number
): ArApSyncPlanRow {
  return {
    ...basePlanRow(row, key),
    willInsert: false,
    willUpdate: true,
    existingDebtId,
    skipReason: null,
    debtLocalAccountId: mapping.localAccountId,
    contactId: mapping.extraFields.contactId ?? null,
    contactFollowSource: mapping.extraFields.contactFollowSource ?? false,
  };
}
