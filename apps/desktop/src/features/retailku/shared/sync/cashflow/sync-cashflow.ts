import { computeCashflowSync } from "./compute-cashflow-sync";
import { insertCashflowTransaction } from "./helpers/insert-cashflow-transaction";
import type { Db, SyncCashflowInput, SyncCashflowResult } from "./types";

// DEBUG SEMENTARA — set false setelah investigasi selesai. Skip semua insert, cuma console.log.
const DRY_RUN = true;

export class SyncCashflowPartialError extends Error {
  constructor(
    public readonly insertedSourceRefs: string[],
    public readonly cause: unknown
  ) {
    super("Sinkronisasi gagal di tengah jalan — sebagian baris sudah ter-insert.");
    this.name = "SyncCashflowPartialError";
  }
}

export async function syncCashflow(db: Db, input: SyncCashflowInput): Promise<SyncCashflowResult> {
  const plan = await computeCashflowSync(db, input);

  if (DRY_RUN) {
    console.log("[DRY_RUN] plan.rows (semua, termasuk skip)", plan.rows);
    console.log("[DRY_RUN] unmappedKeys", plan.unmappedKeys);
    console.log(
      "[DRY_RUN] deactivatedPaymentMethodAccountIds",
      plan.deactivatedPaymentMethodAccountIds
    );
  }

  const insertedSourceRefs: string[] = [];

  try {
    for (const row of plan.rows) {
      if (!row.willInsert || row.localAccountId == null) continue;
      if (DRY_RUN) {
        console.log("[DRY_RUN] cashflow row", {
          accountId: row.localAccountId,
          amount: row.net,
          date: row.date,
          note: row.note,
          categoryId: row.categoryId,
          description: row.description,
          sourceRef: row.sourceRef,
        });
      } else {
        await insertCashflowTransaction(db, {
          accountId: row.localAccountId,
          amount: row.net,
          date: row.date,
          note: row.note,
          categoryId: row.categoryId,
          description: row.description,
          sourceRef: row.sourceRef,
        });
      }
      insertedSourceRefs.push(row.sourceRef);
    }
  } catch (err) {
    throw new SyncCashflowPartialError(insertedSourceRefs, err);
  }

  return {
    insertedCount: insertedSourceRefs.length,
    insertedSourceRefs,
    unmappedKeys: plan.unmappedKeys,
    deactivatedPaymentMethodAccountIds: plan.deactivatedPaymentMethodAccountIds,
  };
}
