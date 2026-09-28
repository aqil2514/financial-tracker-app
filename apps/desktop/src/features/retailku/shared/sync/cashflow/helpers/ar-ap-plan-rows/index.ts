import { alreadySyncedPlanRow } from "./already-synced-plan-row";
import { insertablePlanRow } from "./insertable-plan-row";
import { negativeAmountPlanRow } from "./negative-amount-plan-row";
import { settledDebtNotFoundPlanRow } from "./settled-debt-not-found-plan-row";
import { settlementBatchPlanRow } from "./settlement-batch-plan-row";
import { settlementPartiallyNotFoundPlanRow } from "./settlement-partially-not-found-plan-row";
import { settlementPlanRow } from "./settlement-plan-row";
import { unmappedDebtAccountPlanRow } from "./unmapped-debt-account-plan-row";
import { updatablePlanRow } from "./updatable-plan-row";
import { zeroAmountPlanRow } from "./zero-amount-plan-row";
import { findSyncedArApDebtId } from "../is-ar-ap-row-synced";
import { buildArApMappingKey } from "../extract-ar-ap-rows";
import type { ArApRow } from "../extract-ar-ap-rows";
import type { ArApSyncPlanRow, Db, RetailkuSyncFieldMappingRow } from "../../types";
import type { RetailkuArApExistingMode } from "../../../use-retailku-cashflow-sync-settings";

export type BuildArApPlanRowsResult = {
  planRows: ArApSyncPlanRow[];
  unmappedDebtKeys: string[];
};

// Scope sesi ini: cuma penciptaan piutang/utang baru (amount > 0), lihat
// handover 2026-09-28 sesi 3 — amount<=0 dan cashAccounts sengaja
// belum ditangani. existingMode menentukan perlakuan baris yang SUDAH
// pernah sync sebelumnya: "skip" (default) atau "overwrite" (UPDATE
// debts yang ada, bukan buat baru).
export async function buildArApPlanRows(
  db: Db,
  arApRows: ArApRow[],
  fieldMapping: Map<string, RetailkuSyncFieldMappingRow>,
  existingMode: RetailkuArApExistingMode
): Promise<BuildArApPlanRowsResult> {
  const planRows: ArApSyncPlanRow[] = [];
  const unmappedDebtKeys = new Set<string>();

  for (const row of arApRows) {
    const key = buildArApMappingKey(row.accountId, row.direction);

    if (row.amount === 0) {
      planRows.push(zeroAmountPlanRow(row, key));
      continue;
    }

    if (row.amount < 0) {
      if (!row.isReversed && row.settledReceivablePayableJournalItemIds.length > 0) {
        const allocations: { debtId: number; amount: number }[] = [];
        let allFound = true;
        for (const settled of row.settledReceivablePayableJournalItemIds) {
          const debtId = await findSyncedArApDebtId(db, `${settled.journalItemId}:ar_ap`);
          if (debtId == null) {
            allFound = false;
            break;
          }
          allocations.push({ debtId, amount: settled.amount });
        }
        planRows.push(
          allFound
            ? settlementBatchPlanRow(row, key, allocations)
            : settlementPartiallyNotFoundPlanRow(row, key)
        );
        continue;
      }

      if (!row.isReversed && row.settledReceivablePayableJournalItemId != null) {
        const settledSourceRef = `${row.settledReceivablePayableJournalItemId}:ar_ap`;
        const paymentDebtId = await findSyncedArApDebtId(db, settledSourceRef);
        planRows.push(
          paymentDebtId != null
            ? settlementPlanRow(row, key, paymentDebtId)
            : settledDebtNotFoundPlanRow(row, key)
        );
        continue;
      }
      planRows.push(negativeAmountPlanRow(row, key));
      continue;
    }

    const mapping = fieldMapping.get(key);
    if (mapping == null) {
      unmappedDebtKeys.add(key);
      planRows.push(unmappedDebtAccountPlanRow(row, key));
      continue;
    }

    const existingDebtId = await findSyncedArApDebtId(db, row.sourceRef);
    if (existingDebtId != null) {
      if (existingMode === "overwrite") {
        planRows.push(updatablePlanRow(row, key, mapping, existingDebtId));
      } else {
        planRows.push(alreadySyncedPlanRow(row, key, mapping));
      }
      continue;
    }

    planRows.push(insertablePlanRow(row, key, mapping));
  }

  return { planRows, unmappedDebtKeys: [...unmappedDebtKeys] };
}
