import { computeCashflowSync } from "./compute-cashflow-sync";
import { downPaymentSourceRef, insertArApDownPayment } from "./helpers/insert-ar-ap-down-payment";
import { insertArApPayment } from "./helpers/insert-ar-ap-payment";
import { insertArApPaymentsBatch } from "./helpers/insert-ar-ap-payments-batch";
import { insertArApTransaction } from "./helpers/insert-ar-ap-transaction";
import { insertCashflowTransaction } from "./helpers/insert-cashflow-transaction";
import type { Db, SyncCashflowInput, SyncCashflowResult } from "./types";

const DRY_RUN = false;

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
    console.log("[DRY_RUN] plan.arAp.rows (semua, termasuk skip)", plan.arAp.rows);
    console.log("[DRY_RUN] arApUnmappedDebtKeys", plan.arAp.unmappedDebtKeys);
  }

  const insertedSourceRefs: string[] = [];
  const arApInsertedSourceRefs: string[] = [];
  const arApPaymentInsertedSourceRefs: string[] = [];
  const arApDownPaymentInsertedSourceRefs: string[] = [];
  let arApUpdatedCount = 0;

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

    for (const row of plan.arAp.rows) {
      if (!row.willInsert && !row.willUpdate) continue;
      if (DRY_RUN) {
        console.log(`[DRY_RUN] ar-ap row (${row.willUpdate ? "update" : "insert"})`, {
          debtLocalAccountId: row.debtLocalAccountId,
          direction: row.direction,
          amount: row.amount,
          contactId: row.contactId,
          contactFollowSource: row.contactFollowSource,
          sourceRef: row.sourceRef,
          existingDebtId: row.existingDebtId,
        });
      } else {
        await insertArApTransaction(db, row);
      }
      // Rollback (SyncCashflowPartialError) cuma DELETE by source_ref —
      // baris willUpdate BUKAN insert baru, jangan ikut masuk daftar itu
      // supaya rollback tidak menghapus debts yang sudah ada sebelumnya.
      if (row.willUpdate) {
        arApUpdatedCount++;
      } else {
        arApInsertedSourceRefs.push(row.sourceRef);
      }
    }

    for (const row of plan.arAp.rows) {
      if (row.downPayment == null) continue;
      if (DRY_RUN) {
        console.log("[DRY_RUN] ar-ap down payment row (insert, cashflow biasa)", {
          accountId: row.downPayment.localAccountId,
          amount: row.downPayment.amount,
          date: row.date,
          note: row.downPayment.note,
          sourceRef: downPaymentSourceRef(row),
        });
      } else {
        await insertArApDownPayment(db, row);
      }
      arApDownPaymentInsertedSourceRefs.push(downPaymentSourceRef(row));
    }

    for (const row of plan.arAp.rows) {
      if (!row.willInsertPayment) continue;
      if (DRY_RUN) {
        console.log("[DRY_RUN] ar-ap payment row (insert)", {
          paymentDebtId: row.paymentDebtId,
          paymentAccountId: row.paymentAccountId,
          amount: Math.abs(row.amount),
          date: row.date,
          sourceRef: row.sourceRef,
        });
      } else {
        await insertArApPayment(db, row);
      }
      arApPaymentInsertedSourceRefs.push(row.sourceRef);
    }

    for (const row of plan.arAp.rows) {
      if (row.willInsertPayments.length === 0) continue;
      if (DRY_RUN) {
        console.log("[DRY_RUN] ar-ap payments batch row (insert, consignment)", {
          allocations: row.willInsertPayments,
          paymentAccountId: row.paymentAccountId,
          date: row.date,
          sourceRef: row.sourceRef,
        });
      } else {
        await insertArApPaymentsBatch(db, row);
      }
      for (const allocation of row.willInsertPayments) {
        arApPaymentInsertedSourceRefs.push(`${row.sourceRef}:${allocation.debtId}`);
      }
    }
  } catch (err) {
    throw new SyncCashflowPartialError(
      [
        ...insertedSourceRefs,
        ...arApInsertedSourceRefs,
        ...arApPaymentInsertedSourceRefs,
        ...arApDownPaymentInsertedSourceRefs,
      ],
      err
    );
  }

  return {
    insertedCount: insertedSourceRefs.length,
    insertedSourceRefs,
    unmappedKeys: plan.unmappedKeys,
    deactivatedPaymentMethodAccountIds: plan.deactivatedPaymentMethodAccountIds,
    arApInsertedCount: arApInsertedSourceRefs.length,
    arApInsertedSourceRefs,
    arApUpdatedCount,
    arApPaymentInsertedCount: arApPaymentInsertedSourceRefs.length,
    arApPaymentInsertedSourceRefs,
    arApDownPaymentInsertedCount: arApDownPaymentInsertedSourceRefs.length,
    arApDownPaymentInsertedSourceRefs,
    arApUnmappedDebtKeys: plan.arAp.unmappedDebtKeys,
  };
}
