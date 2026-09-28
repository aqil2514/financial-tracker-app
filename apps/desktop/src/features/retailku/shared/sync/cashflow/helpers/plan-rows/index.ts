import { isPeriodSynced } from "../is-period-synced";
import { alreadySyncedPlanRow } from "./already-synced-plan-row";
import { deactivatedPaymentMethodPlanRow } from "./deactivated-payment-method-plan-row";
import { insertablePlanRow } from "./insertable-plan-row";
import { resolveMappedTotal } from "./resolve-mapped-total";
import { unmappedPlanRow } from "./unmapped-plan-row";
import type { AggregatedTotal, CashflowSyncPlanRow, Db, RetailkuSyncFieldMappingRow } from "../../types";

export type BuildPlanRowsResult = {
  planRows: CashflowSyncPlanRow[];
  unmappedKeys: string[];
  deactivatedPaymentMethodAccountIds: string[];
};

/** Ubah tiap `total` hasil agregasi jadi satu `CashflowSyncPlanRow` —
 * insert, atau skip dengan salah satu alasan (net nol dilewati total,
 * belum di-mapping, akunnya dinonaktifkan sbg payment method, atau
 * periode itu sudah pernah tersinkron). */
export async function buildPlanRows(
  totals: AggregatedTotal[],
  fieldMapping: Map<string, RetailkuSyncFieldMappingRow>,
  activePaymentMethodIds: Set<string>,
  db: Db
): Promise<BuildPlanRowsResult> {
  const planRows: CashflowSyncPlanRow[] = [];
  const unmappedKeys = new Set<string>();
  const deactivatedPaymentMethodAccountIds = new Set<string>();

  for (const total of totals) {
    if (total.net === 0) continue;

    const mapping = fieldMapping.get(total.key) ?? null;
    if (mapping == null) {
      unmappedKeys.add(total.key);
      planRows.push(unmappedPlanRow(total));
      continue;
    }

    const resolved = resolveMappedTotal(total, mapping);

    if (!activePaymentMethodIds.has(total.retailkuAccountId)) {
      deactivatedPaymentMethodAccountIds.add(total.retailkuAccountId);
      planRows.push(deactivatedPaymentMethodPlanRow(resolved, mapping.localAccountId));
      continue;
    }

    const alreadySynced = await isPeriodSynced(db, total.date, total.retailkuAccountId);
    if (alreadySynced) {
      planRows.push(alreadySyncedPlanRow(resolved, mapping.localAccountId));
      continue;
    }

    planRows.push(insertablePlanRow(resolved, mapping.localAccountId));
  }

  return {
    planRows,
    unmappedKeys: [...unmappedKeys],
    deactivatedPaymentMethodAccountIds: [...deactivatedPaymentMethodAccountIds],
  };
}
