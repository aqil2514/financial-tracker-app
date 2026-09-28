import { connectRetailkuMcp } from "@/shared/retailku";
import { aggregateTotals } from "./helpers/aggregate";
import { buildArApPlanRows } from "./helpers/ar-ap-plan-rows";
import { buildPlanRows } from "./helpers/plan-rows";
import { extractArApRows } from "./helpers/extract-ar-ap-rows";
import { loadSyncInputs } from "./helpers/load-sync-inputs";
import type { CashflowSyncPlan, Db, SyncCashflowInput } from "./types";

export async function computeCashflowSync(
  db: Db,
  input: Pick<SyncCashflowInput, "mcpConfig" | "dateFrom" | "dateTo" | "timezone" | "mode" | "arApExistingMode">
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

    const arApRows = extractArApRows(rows);
    const { planRows: arApPlanRows, unmappedDebtKeys } = await buildArApPlanRows(
      db,
      arApRows,
      fieldMapping,
      input.arApExistingMode
    );

    return {
      rows: planRows,
      unmappedKeys,
      deactivatedPaymentMethodAccountIds,
      arAp: { rows: arApPlanRows, unmappedDebtKeys },
    };
  } finally {
    await client.close();
  }
}
