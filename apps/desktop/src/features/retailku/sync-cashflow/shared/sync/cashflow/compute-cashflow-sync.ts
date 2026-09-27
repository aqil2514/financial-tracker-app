import { connectRetailkuMcp } from "@/shared/retailku";
import { aggregateTotals } from "./helpers/aggregate";
import { buildArApPlanRows } from "./helpers/ar-ap-plan-rows";
import { buildPlanRows } from "./helpers/plan-rows";
import { loadSyncInputs } from "./helpers/load-sync-inputs";
import type { CashflowSyncPlan, Db, SyncCashflowInput } from "./types";

/** Hitung APA yang akan disinkronkan TANPA menulis apa pun ke database
 * — dipakai baik oleh sync sungguhan maupun preview (baca-saja). */
export async function computeCashflowSync(
  db: Db,
  input: Pick<
    SyncCashflowInput,
    | "mcpConfig"
    | "dateFrom"
    | "dateTo"
    | "timezone"
    | "mode"
    | "receivableDebtAccountId"
    | "payableDebtAccountId"
    | "arApCashAccountId"
  >
): Promise<CashflowSyncPlan> {
  const client = await connectRetailkuMcp(input.mcpConfig);
  try {
    const { rows, fieldMapping, activePaymentMethodIds } = await loadSyncInputs(client, db, input);

    const totals = aggregateTotals(rows, input.mode);
    const { planRows, unmappedKeys, deactivatedPaymentMethodAccountIds } = await buildPlanRows(
      totals,
      fieldMapping,
      activePaymentMethodIds,
      db
    );

    const arApPlanRows = await buildArApPlanRows(db, rows, input);

    return {
      rows: planRows,
      unmappedKeys,
      deactivatedPaymentMethodAccountIds,
      arApRows: arApPlanRows,
    };
  } finally {
    await client.close();
  }
}
