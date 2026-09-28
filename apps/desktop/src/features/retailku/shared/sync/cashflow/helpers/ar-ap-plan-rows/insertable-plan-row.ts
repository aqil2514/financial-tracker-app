import { basePlanRow } from "./base-plan-row";
import type { ArApRow } from "../extract-ar-ap-rows";
import type { ArApSyncPlanRow, RetailkuSyncFieldMappingRow } from "../../types";

export function insertablePlanRow(
  row: ArApRow,
  key: string,
  mapping: RetailkuSyncFieldMappingRow
): ArApSyncPlanRow {
  return {
    ...basePlanRow(row, key),
    willInsert: true,
    skipReason: null,
    debtLocalAccountId: mapping.localAccountId,
    contactId: mapping.extraFields.contactId ?? null,
    contactFollowSource: mapping.extraFields.contactFollowSource ?? false,
  };
}
