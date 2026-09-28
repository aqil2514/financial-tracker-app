import type { connectRetailkuMcp } from "@/shared/retailku";
import { fetchAllCashflowDetailRows } from "./fetch-all-cashflow-detail-rows";
import { loadFieldMapping } from "./load-field-mapping";
import { loadActivePaymentMethodIds } from "./load-active-payment-method-ids";
import type { Db, SyncCashflowInput } from "../../types";

/** Kumpulkan 3 input independen yang dibutuhkan `computeCashflowSync`
 * sebelum agregasi — dijalankan paralel (`Promise.all`) karena
 * tidak saling bergantung. */
export async function loadSyncInputs(
  client: Awaited<ReturnType<typeof connectRetailkuMcp>>,
  db: Db,
  input: Pick<SyncCashflowInput, "dateFrom" | "dateTo" | "timezone">
) {
  const [rows, fieldMapping, activePaymentMethodIds] = await Promise.all([
    fetchAllCashflowDetailRows(client, input),
    loadFieldMapping(db),
    loadActivePaymentMethodIds(client),
  ]);

  return { rows, fieldMapping, activePaymentMethodIds };
}
