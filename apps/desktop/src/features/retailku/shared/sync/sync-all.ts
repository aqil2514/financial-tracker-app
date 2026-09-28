import { getDb } from "@/lib/db";
import type { RetailkuMcpConfig } from "@/shared/retailku";
import { syncCashflow, SyncCashflowPartialError } from "./cashflow";
import type { RetailkuCashflowSyncMode } from "./use-retailku-cashflow-sync-settings";

type Db = Awaited<ReturnType<typeof getDb>>;

export type SyncAllInput = {
  mcpConfig: RetailkuMcpConfig;
  dateFrom: string;
  dateTo: string;
  timezone: string;
  mode: RetailkuCashflowSyncMode;
};

export type SyncAllResult = {
  cashflowInsertedCount: number;
  cashflowUnmappedKeys: string[];
  cashflowDeactivatedPaymentMethodAccountIds: string[];
};

// Lock in-memory modul-level — mencegah 2 panggilan syncAll (mis. dobel klik) berjalan bersamaan.
let syncInFlight: Promise<SyncAllResult> | null = null;

export function syncAll(input: SyncAllInput): Promise<SyncAllResult> {
  const previous = syncInFlight;
  const result = (async () => {
    if (previous) await previous.catch(() => {});
    return syncAllInternal(input);
  })();

  syncInFlight = result.finally(() => {
    if (syncInFlight === result) syncInFlight = null;
  });
  return result;
}

async function syncAllInternal(input: SyncAllInput): Promise<SyncAllResult> {
  const db = await getDb();

  try {
    const result = await syncCashflow(db, {
      mcpConfig: input.mcpConfig,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      timezone: input.timezone,
      mode: input.mode,
    });

    return {
      cashflowInsertedCount: result.insertedCount,
      cashflowUnmappedKeys: result.unmappedKeys,
      cashflowDeactivatedPaymentMethodAccountIds: result.deactivatedPaymentMethodAccountIds,
    };
  } catch (err) {
    if (err instanceof SyncCashflowPartialError) {
      await rollbackManually(db, err.insertedSourceRefs);
      throw err.cause;
    }
    throw err;
  }
}

async function rollbackManually(db: Db, insertedSourceRefs: string[]): Promise<void> {
  if (insertedSourceRefs.length === 0) return;

  const placeholders = insertedSourceRefs.map((_, i) => `$${i + 1}`).join(", ");

  await db.execute(
    `DELETE FROM debts WHERE transaction_id IN (
       SELECT id FROM transactions WHERE source = 'retailku_sync' AND source_ref IN (${placeholders})
     )`,
    insertedSourceRefs
  );
  await db.execute(
    `DELETE FROM transactions WHERE source = 'retailku_sync' AND source_ref IN (${placeholders})`,
    insertedSourceRefs
  );
}
