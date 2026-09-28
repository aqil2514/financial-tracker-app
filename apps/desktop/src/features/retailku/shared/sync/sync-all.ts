import { getDb } from "@/lib/db";
import type { RetailkuMcpConfig } from "@/shared/retailku";
import { syncCashflow, SyncCashflowPartialError } from "./cashflow";
import type { RetailkuArApExistingMode, RetailkuCashflowSyncMode } from "./use-retailku-cashflow-sync-settings";

type Db = Awaited<ReturnType<typeof getDb>>;

export type SyncAllInput = {
  mcpConfig: RetailkuMcpConfig;
  dateFrom: string;
  dateTo: string;
  timezone: string;
  mode: RetailkuCashflowSyncMode;
  arApExistingMode: RetailkuArApExistingMode;
};

export type SyncAllResult = {
  cashflowInsertedCount: number;
  cashflowUnmappedKeys: string[];
  cashflowDeactivatedPaymentMethodAccountIds: string[];
  arApInsertedCount: number;
  arApUpdatedCount: number;
  arApPaymentInsertedCount: number;
  arApUnmappedDebtKeys: string[];
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
      arApExistingMode: input.arApExistingMode,
    });

    return {
      cashflowInsertedCount: result.insertedCount,
      cashflowUnmappedKeys: result.unmappedKeys,
      cashflowDeactivatedPaymentMethodAccountIds: result.deactivatedPaymentMethodAccountIds,
      arApInsertedCount: result.arApInsertedCount,
      arApUpdatedCount: result.arApUpdatedCount,
      arApPaymentInsertedCount: result.arApPaymentInsertedCount,
      arApUnmappedDebtKeys: result.arApUnmappedDebtKeys,
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

  // debts.source_ref langsung (bukan lewat transactions) — sebagian baris
  // AR/AP sekarang transaction_id: NULL, jadi subquery lewat transactions
  // tidak akan menjangkaunya. debt_payments dari CICILAN piutang baru
  // (debts yg SAMA-SAMA baru insert di sync ini) ikut terhapus via ON
  // DELETE CASCADE — TAPI debt_payments dari sync PELUNASAN (piutangnya
  // SUDAH ADA sebelum sync ini, source_ref SENDIRI beda dari debts manapun
  // di daftar ini) TIDAK ikut ter-cascade, jadi dihapus eksplisit di bawah.
  await db.execute(
    `DELETE FROM debts WHERE source_ref IN (${placeholders})`,
    insertedSourceRefs
  );
  await db.execute(
    `DELETE FROM debt_payments WHERE source_ref IN (${placeholders})`,
    insertedSourceRefs
  );
  await db.execute(
    `DELETE FROM transactions WHERE source = 'retailku_sync' AND source_ref IN (${placeholders})`,
    insertedSourceRefs
  );
}
