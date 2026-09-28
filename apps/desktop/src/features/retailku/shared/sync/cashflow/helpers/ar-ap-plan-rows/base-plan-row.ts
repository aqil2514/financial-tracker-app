import type { ArApRow } from "../extract-ar-ap-rows";
import type { ArApSyncPlanRow } from "../../types";

export function basePlanRow(
  row: ArApRow,
  key: string
): Omit<ArApSyncPlanRow, "willInsert" | "skipReason"> {
  return {
    journalItemId: row.journalItemId,
    date: row.date,
    accountId: row.accountId,
    accountName: row.accountName,
    direction: row.direction,
    kind: row.kind,
    partyName: row.partyName,
    amount: row.amount,
    sourceRef: row.sourceRef,
    key,
    willUpdate: false,
    existingDebtId: null,
    willInsertPayment: false,
    paymentDebtId: null,
    willInsertPayments: [],
    paymentAccountId: null,
    downPayment: null,
    debtLocalAccountId: null,
    contactId: null,
    contactFollowSource: false,
  };
}
