import { connectRetailkuMcp } from "@/shared/retailku";
import { aggregateTotals } from "./helpers/aggregate";
import { buildPlanRows } from "./helpers/plan-rows";
import { loadSyncInputs } from "./helpers/load-sync-inputs";
import type { CashflowSyncPlan, Db, SyncCashflowInput } from "./types";

export async function computeCashflowSync(
  db: Db,
  input: Pick<SyncCashflowInput, "mcpConfig" | "dateFrom" | "dateTo" | "timezone" | "mode">
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

    return {
      rows: planRows,
      unmappedKeys,
      deactivatedPaymentMethodAccountIds,
    };
  } finally {
    await client.close();
  }
}
