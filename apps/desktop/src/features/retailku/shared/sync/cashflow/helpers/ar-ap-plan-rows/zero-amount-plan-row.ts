import { basePlanRow } from "./base-plan-row";
import type { ArApRow } from "../extract-ar-ap-rows";
import type { ArApSyncPlanRow } from "../../types";

export function zeroAmountPlanRow(row: ArApRow, key: string): ArApSyncPlanRow {
  return { ...basePlanRow(row, key), willInsert: false, skipReason: "zero-amount" };
}
