import { computeCashflowSync } from "./compute-cashflow-sync";
import { insertArApTransaction } from "./helpers/insert-ar-ap-transaction";
import { insertCashflowTransaction } from "./helpers/insert-cashflow-transaction";
import type { Db, SyncCashflowInput, SyncCashflowResult } from "./types";

/** DEBUG SEMENTARA — set `false` lagi setelah selesai investigasi
 * utang-piutang dagang/non-dagang. Saat `true`, TIDAK ADA insert
 * apa pun ke database (skip `insertCashflowTransaction`/
 * `insertArApTransaction` sepenuhnya) — cuma `console.log` tiap baris
 * yang SEHARUSNYA di-insert, supaya "Sync Sekarang" bisa dicoba
 * berkali-kali tanpa mengotori `finance.dev.db`. */
const DRY_RUN = true;

/** Dilempar kalau insert gagal DI TENGAH JALAN (loop cashflow ATAU
 * AR/AP) — membawa `insertedSourceRefs` yang SUDAH berhasil sejauh itu,
 * supaya `sync-all.ts` bisa rollback baris-baris itu secara spesifik
 * (BUKAN cuma error generik yang kehilangan jejak apa saja yang sempat
 * ter-insert sebelum kegagalan) — mempertahankan jaminan yang sama
 * dengan pola lama (`syncArAp`/`syncCashflow` terpisah, DIHAPUS),
 * cuma sekarang satu Error alih-alih dua hasil parsial berbeda. */
export class SyncCashflowPartialError extends Error {
  constructor(
    public readonly insertedSourceRefs: string[],
    public readonly cause: unknown
  ) {
    super("Sinkronisasi gagal di tengah jalan — sebagian baris sudah ter-insert.");
    this.name = "SyncCashflowPartialError";
  }
}

/**
 * Sinkronisasi cashflow Retailku -> transaksi lokal, lihat
 * docs/todos/plan/retailku-cashflow-sync.md keputusan #1 (idempotency),
 * #2 REVISI (per akun kas Retailku sendiri-sendiri, BUKAN konvergen ke
 * satu akun lokal) dan #6 (mode ringkas/detail). SUMBER DATA SEKARANG
 * SELALU `get_cashflow_detail` (punya `accountId` per baris) — TIDAK
 * LAGI memakai `get_cashflow_summary` sama sekali, bahkan untuk mode
 * ringkas, karena tool itu tidak punya breakdown per akun.
 *
 * TIDAK dibungkus BEGIN/COMMIT SQL (lihat "Bug ditemukan live" di
 * retailku-cashflow-sync.md — @tauri-apps/plugin-sql tidak mendukung
 * itu dengan aman) — caller (`sync-all.ts`) melakukan rollback MANUAL
 * (DELETE) berdasar `insertedSourceRefs` yang dikembalikan di sini kalau
 * jalur lain gagal.
 *
 * Logic fetch+agregasi+cek mapping/idempotency ada di
 * `computeCashflowSync` — fungsi ini tinggal INSERT baris yang
 * `willInsert: true`.
 *
 * SEKARANG JUGA meng-insert piutang/utang (`plan.arApRows`) dalam SATU
 * alur yang sama — MENGGANTIKAN `syncArAp` terpisah (`sync-ar-ap.ts`,
 * DIHAPUS beserta `retailku_ar_ap_snapshot`), lihat
 * docs/todos/plan/retailku-ar-ap-via-cashflow-detail.md. `insertedSourceRefs`
 * yang dikembalikan MENCAKUP baris AR/AP juga — `sync-all.ts` jadi lebih
 * sederhana (SATU set rollback, bukan dua jalur terpisah).
 */
export async function syncCashflow(db: Db, input: SyncCashflowInput): Promise<SyncCashflowResult> {
  const plan = await computeCashflowSync(db, input);

  if (DRY_RUN) {
    console.log("[DRY_RUN] plan.rows (semua, termasuk skip)", plan.rows);
    console.log("[DRY_RUN] plan.arApRows (semua, termasuk skip)", plan.arApRows);
    console.log("[DRY_RUN] unmappedKeys", plan.unmappedKeys);
    console.log(
      "[DRY_RUN] deactivatedPaymentMethodAccountIds",
      plan.deactivatedPaymentMethodAccountIds
    );
  }

  const insertedSourceRefs: string[] = [];
  let arApInsertedCount = 0;
  let arApAccountNotConfigured = false;

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

    for (const arApRow of plan.arApRows) {
      if (arApRow.skipReason === "debt-account-not-configured") {
        arApAccountNotConfigured = true;
        continue;
      }
      if (!arApRow.willInsert) continue;

      const debtAccountId =
        arApRow.direction === "receivable" ? input.receivableDebtAccountId : input.payableDebtAccountId;
      // `debtAccountId`/`input.arApCashAccountId` SUDAH dipastikan
      // non-null oleh computeCashflowSync (baris ini tidak akan
      // `willInsert: true` kalau salah satunya null) — non-null
      // assertion di sini AMAN, bukan asumsi baru.
      if (DRY_RUN) {
        console.log("[DRY_RUN] ar/ap row", {
          arApRow,
          arApCashAccountId: input.arApCashAccountId,
          debtAccountId,
        });
      } else {
        await insertArApTransaction(db, arApRow, input.arApCashAccountId!, debtAccountId!);
      }
      insertedSourceRefs.push(arApRow.sourceRef);
      arApInsertedCount += 1;
    }
  } catch (err) {
    // Lempar ulang MEMBAWA jejak baris yang SUDAH berhasil sejauh ini —
    // lihat SyncCashflowPartialError.
    throw new SyncCashflowPartialError(insertedSourceRefs, err);
  }

  return {
    insertedCount: insertedSourceRefs.length,
    insertedSourceRefs,
    unmappedKeys: plan.unmappedKeys,
    deactivatedPaymentMethodAccountIds: plan.deactivatedPaymentMethodAccountIds,
    arApInsertedCount,
    arApAccountNotConfigured,
  };
}
