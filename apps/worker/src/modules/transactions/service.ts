import type { Env } from "../../shared/env";
import type { SyncSource } from "../../shared/auth";
import type { PushTransactionPayload, PatchTransactionPayload } from "./schema";
import {
  applyDebtTransaction,
  applyDebtEditAction,
  checkDebtEditAllowed,
  getTransactionDebtStatus,
  validateDebtSettlementAmount,
  validateAccountPairSupported,
  detachDebtForDeletedTransaction,
  DebtEditBlockedError,
  type DeletedTransactionDebtInfo,
} from "../debts/service";
import { resolveContactId } from "../contacts/service";
import { nowText, resolveIncomingUpdatedAt, decideLww } from "../../shared/lww";

// contactId eksplisit SELALU menang; contactName (nama natural dari tool
// MCP) cuma dipakai kalau contactId kosong -- lihat keputusan desain di
// transactions/schema.ts.
async function resolveFinalContactId(
  env: Env,
  payload: Pick<PushTransactionPayload, "contactId" | "contactName">,
  syncSource: SyncSource
): Promise<string | null> {
  if (payload.contactId) return payload.contactId;
  if (!payload.contactName) return payload.contactId ?? null;
  return resolveContactId(env, payload.contactName, syncSource);
}

export type InsertTransactionResult =
  | { status: "ok" }
  | { status: "ignored" }
  | { status: "rejected"; reason: string };

export type UpdateTransactionResult =
  | { status: "ok" }
  | { status: "ignored" }
  | { status: "not_found" }
  | { status: "rejected"; reason: string };

// categoryId FK ke categories(id) tidak di-precheck sebelumnya (beda
// dari accountId/transferAccountId yang sudah lewat getAccountType) --
// kalau kategori belum ter-sync ke D1 (race push transaksi vs push
// kategori dari PC), INSERT/UPDATE kena SQLITE_CONSTRAINT_FOREIGNKEY
// mentah yang lolos jadi 500 tak terduga, bukan 422 yang jelas. Lihat
// investigasi 2026-10-04 (3 baris di cloud_sync_queue stuck retry
// dengan last_error='HTTP 500', reproduced di wrangler dev local).
//
// Sekaligus validasi logic #category-type dari
// mcp-server-business-logic-audit.md: desktop cuma memfilter kategori
// via UI (use-account-category-options.tsx, category.type === type),
// TIDAK ADA constraint DB -- tool MCP/push yg lewat Worker langsung
// bisa kirim category_id expense utk transaksi income tanpa ketahuan.
// Digabung dalam satu query (bukan precheck terpisah) krn sama-sama
// butuh baca row categories yang sama.
async function getCategoryType(env: Env, categoryId: string): Promise<"income" | "expense" | null> {
  const row = await env.DB.prepare("SELECT type FROM categories WHERE id = ?1 AND deleted_at IS NULL")
    .bind(categoryId)
    .first<{ type: "income" | "expense" }>();
  return row?.type ?? null;
}

async function validateCategoryExists(
  env: Env,
  categoryId: string | null | undefined,
  transactionType: "income" | "expense" | "transfer"
): Promise<{ status: "ok" } | { status: "rejected"; reason: string }> {
  if (!categoryId) return { status: "ok" };
  const categoryType = await getCategoryType(env, categoryId);
  if (categoryType === null) {
    return {
      status: "rejected",
      reason: "Kategori belum ditemukan di cloud (kemungkinan belum ter-sync) — coba lagi setelah kategori tersinkron.",
    };
  }
  if (transactionType !== "transfer" && categoryType !== transactionType) {
    return {
      status: "rejected",
      reason: `Kategori ini bertipe '${categoryType}', tidak bisa dipakai untuk transaksi '${transactionType}'.`,
    };
  }
  return { status: "ok" };
}

// Sama alasannya dgn validateCategoryExists -- tapi khusus contactId
// EKSPLISIT (bukan contactName, yg sudah get-or-create lewat
// resolveContactId). resolvedContactId dicek SETELAH resolveFinalContactId
// krn baru di situ tahu ID final-nya (bisa dari contactId langsung atau
// hasil resolve by name).
async function validateResolvedContactExists(
  env: Env,
  contactId: string | null
): Promise<{ status: "ok" } | { status: "rejected"; reason: string }> {
  if (!contactId) return { status: "ok" };
  const row = await env.DB.prepare("SELECT 1 FROM contacts WHERE id = ?1 AND deleted_at IS NULL")
    .bind(contactId)
    .first();
  if (row !== null) return { status: "ok" };
  return {
    status: "rejected",
    reason: "Kontak belum ditemukan di cloud (kemungkinan belum ter-sync) — coba lagi setelah kontak tersinkron.",
  };
}

// UPSERT dgn LWW (lihat shared/lww.ts). `id` sudah ada di D1 -> delegasi
// ke updateTransactionRow (logic sama persis dgn jalur PATCH, krn
// semantiknya memang sama: "tulis baris ini kalau lebih baru dari yg
// ada"). LWW compare dicek PALING AWAL, SEBELUM validasi bisnis apa pun
// (#4, #3, dst) -- payload yg toh mau diabaikan tidak perlu divalidasi.
export async function insertTransaction(
  env: Env,
  payload: PushTransactionPayload,
  syncSource: SyncSource
): Promise<InsertTransactionResult> {
  const existing = await env.DB.prepare("SELECT updated_at FROM transactions WHERE id = ?1")
    .bind(payload.id)
    .first<{ updated_at: string | null }>();

  const incomingUpdatedAt = resolveIncomingUpdatedAt(payload.updatedAt);
  const decision = decideLww(incomingUpdatedAt, existing?.updated_at ?? null);
  if (decision.outcome === "stale") return { status: "ignored" };

  if (existing) {
    // Row sudah ada & payload lebih baru -- PERSIS semantik PATCH,
    // reuse fungsi yg sama (termasuk #2/#3/#7, bukan cuma #1/#4).
    const result = await updateTransactionRow(env, payload.id, payload, decision.updatedAt, syncSource);
    if (result.status === "not_found") {
      // Tidak mungkin terjadi (existing sudah dicek barusan), tapi
      // dipertahankan sbg union type lengkap -- treat spt create gagal.
      return { status: "rejected", reason: "Transaction vanished during upsert" };
    }
    return result;
  }

  return createTransactionRow(env, payload, decision.updatedAt, syncSource);
}

async function createTransactionRow(
  env: Env,
  payload: PushTransactionPayload,
  updatedAt: string,
  syncSource: SyncSource
): Promise<InsertTransactionResult> {
  // Pertanyaan #4 audit-kepatuhan-konsep-tipe-akun.md: kombinasi tipe
  // akun di luar cash/debt (misal cash->investment) HARUS ditolak SEBELUM
  // insert, bukan ketahuan belakangan di applyDebtTransaction (sama
  // alasan atomicity dgn precheck settlement di bawah).
  const accountPairPrecheck = await validateAccountPairSupported(env, {
    type: payload.type,
    accountId: payload.accountId,
    transferAccountId: payload.transferAccountId ?? null,
  });
  if (accountPairPrecheck.status === "rejected") return accountPairPrecheck;

  const categoryPrecheck = await validateCategoryExists(env, payload.categoryId, payload.type);
  if (categoryPrecheck.status === "rejected") return categoryPrecheck;

  // Logic #3 dicek SEBELUM insert baris transaksi -- kalau reject
  // terjadi SETELAH insert (di dalam applyDebtTransaction), baris
  // transaksi sudah terlanjur tersimpan tanpa debt_payments terkait
  // (tidak atomic, D1 batch tidak cocok krn FIFO butuh baca-lalu-tulis
  // dua fase). Lihat validateDebtSettlementAmount di debts/service.ts.
  if (payload.type === "transfer" && payload.debtAction === "settlement") {
    const precheck = await validateDebtSettlementAmount(env, {
      amount: payload.amount,
      settleDebtIds: payload.settleDebtIds ?? [],
    });
    if (precheck.status === "rejected") return precheck;
  }

  if (await hasSourceRefConflict(env, payload.id, payload)) {
    return { status: "rejected", reason: SOURCE_REF_CONFLICT_REASON };
  }

  const resolvedContactId = await resolveFinalContactId(env, payload, syncSource);
  const contactPrecheck = await validateResolvedContactExists(env, resolvedContactId);
  if (contactPrecheck.status === "rejected") return contactPrecheck;

  const now = nowText();
  await env.DB.prepare(
    `INSERT INTO transactions
       (id, type, amount, category_id, account_id, transfer_account_id,
        note, date, description, contact_id, created_at, updated_at, sync_source,
        source, source_ref)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      payload.id,
      payload.type,
      payload.amount,
      payload.type === "transfer" ? null : payload.categoryId ?? null,
      payload.accountId ?? null,
      payload.transferAccountId ?? null,
      payload.note,
      payload.date,
      payload.description ?? null,
      resolvedContactId,
      now,
      updatedAt,
      syncSource,
      payload.source ?? "manual",
      payload.source !== undefined ? payload.sourceRef ?? null : null
    )
    .run();

  // Logic #1 (FIFO debt) -- PEMILIK-nya modul debts, dipanggil dari
  // sini sbg PEMICU krn butuh transactionId dari insert di atas. Lihat
  // apps/worker/docs/rules/module-structure.md. TIDAK bisa reject lagi
  // di titik ini krn logic #3 sudah dicek di atas sebelum insert.
  //
  // syncSource !== 'pc': transaksi dari PC SUDAH punya baris debts/
  // debt_payments sendiri (apply-debt-transaction.ts lokal, dipush
  // terpisah lewat cloud_sync_queue) -- derivasi Worker di sini KHUSUS
  // utk transaksi yg TIDAK py padanan lokal (MCP), supaya tidak dobel.
  // Lihat docs/todos/plan/fix-debts-duplikasi-sync.md.
  if (payload.type === "transfer" && payload.accountId && syncSource !== "pc") {
    await applyDebtTransaction(env, {
      transactionId: payload.id,
      type: payload.type,
      accountId: payload.accountId,
      transferAccountId: payload.transferAccountId ?? null,
      contactId: resolvedContactId,
      amount: payload.amount,
      date: payload.date,
      debtAction: payload.debtAction ?? null,
      settleDebtIds: payload.settleDebtIds ?? [],
      syncSource,
    });
  }

  return { status: "ok" };
}

const SOURCE_REF_CONFLICT_REASON =
  "source_ref ini sudah dipakai transaksi lain di cloud (baris Retailku yg sama ter-sync dari PC berbeda) — baris ini tidak disimpan supaya tidak dobel.";

// Idempotency jalur Retailku: (source, source_ref) UNIQUE di D1
// (idx_transactions_source_ref). Dicek eksplisit SEBELUM tulis supaya
// bentrok jadi 'rejected' (422, tidak di-retry PC) alih-alih error
// constraint mentah (500, di-retry terus tanpa akhir).
async function hasSourceRefConflict(
  env: Env,
  id: string,
  payload: Pick<PushTransactionPayload, "source" | "sourceRef">
): Promise<boolean> {
  if (payload.source === undefined || !payload.sourceRef) return false;
  const row = await env.DB.prepare(
    "SELECT id FROM transactions WHERE source = ?1 AND source_ref = ?2 AND id <> ?3"
  )
    .bind(payload.source, payload.sourceRef, id)
    .first<{ id: string }>();
  return row !== null;
}

type ExistingTransactionRow = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  account_id: string | null;
  transfer_account_id: string | null;
  contact_id: string | null;
};

// Logic #7 dari mcp-server-business-logic-audit.md, port dari
// use-update-transaction.ts (dangerousFieldsChanged) -- field yg
// mempengaruhi PERHITUNGAN debt. Field lain (note, description, date)
// tidak pernah trigger recreate debt.
function dangerousFieldsChanged(
  existing: ExistingTransactionRow,
  payload: PatchTransactionPayload,
  resolvedContactId: string | null
): boolean {
  return (
    payload.type !== existing.type ||
    (payload.accountId ?? null) !== existing.account_id ||
    (payload.transferAccountId ?? null) !== existing.transfer_account_id ||
    payload.amount !== existing.amount ||
    resolvedContactId !== existing.contact_id
  );
}

// Endpoint PATCH /transactions/:id -- entry point publik, cek LWW +
// not_found SEBELUM delegasi ke updateTransactionRow (logic inti, jg
// dipakai dari insertTransaction saat id ternyata sudah ada -- lihat
// shared/lww.ts). LWW dicek PALING AWAL, SEBELUM validasi bisnis apa pun.
export async function updateTransaction(
  env: Env,
  id: string,
  payload: PatchTransactionPayload,
  syncSource: SyncSource
): Promise<UpdateTransactionResult> {
  const existingMeta = await env.DB.prepare("SELECT updated_at FROM transactions WHERE id = ?1")
    .bind(id)
    .first<{ updated_at: string | null }>();
  if (!existingMeta) return { status: "not_found" };

  const incomingUpdatedAt = resolveIncomingUpdatedAt(payload.updatedAt);
  const decision = decideLww(incomingUpdatedAt, existingMeta.updated_at);
  if (decision.outcome === "stale") return { status: "ignored" };

  return updateTransactionRow(env, id, payload, decision.updatedAt, syncSource);
}

// Logic inti UPDATE, port dari use-update-transaction.ts +
// applyDebtTransactionEdit -- DIPANGGIL dari 2 jalur: updateTransaction
// (PATCH, existing sudah dicek py caller) DAN insertTransaction (POST
// yg ternyata id-nya sudah ada, upsert LWW). `updatedAt` SUDAH
// diputuskan pemenang LWW-nya oleh caller, di sini cuma dipakai apa
// adanya utk nilai kolom.
async function updateTransactionRow(
  env: Env,
  id: string,
  payload: PatchTransactionPayload,
  updatedAt: string,
  syncSource: SyncSource
): Promise<UpdateTransactionResult> {
  const existing = await env.DB.prepare(
    "SELECT id, type, amount, account_id, transfer_account_id, contact_id FROM transactions WHERE id = ?1"
  )
    .bind(id)
    .first<ExistingTransactionRow>();
  if (!existing) return { status: "not_found" };

  // Pertanyaan #4 audit-kepatuhan-konsep-tipe-akun.md -- sama alasannya
  // dgn createTransactionRow: cegah UPDATE tersimpan dgn kombinasi tipe
  // akun yang belum didukung.
  const accountPairPrecheck = await validateAccountPairSupported(env, {
    type: payload.type,
    accountId: payload.accountId,
    transferAccountId: payload.transferAccountId ?? null,
  });
  if (accountPairPrecheck.status === "rejected") return accountPairPrecheck;

  const categoryPrecheck = await validateCategoryExists(env, payload.categoryId, payload.type);
  if (categoryPrecheck.status === "rejected") return categoryPrecheck;

  const resolvedContactId = await resolveFinalContactId(env, payload, syncSource);
  const contactPrecheck = await validateResolvedContactExists(env, resolvedContactId);
  if (contactPrecheck.status === "rejected") return contactPrecheck;

  const fieldsChanged = dangerousFieldsChanged(existing, payload, resolvedContactId);

  // Logic #3 pre-check -- sama alasannya dgn createTransactionRow: cegah
  // UPDATE transaksi tersimpan sementara settlement-nya ditolak.
  if (payload.type === "transfer" && payload.debtAction === "settlement") {
    const precheck = await validateDebtSettlementAmount(env, {
      amount: payload.amount,
      settleDebtIds: payload.settleDebtIds ?? [],
    });
    if (precheck.status === "rejected") return precheck;
  }

  // Logic #2 pre-check: resolve status SEBELUM update baris transaksi
  // -- kalau nanti DebtEditBlockedError dilempar, UPDATE transactions
  // belum sempat jalan (konsisten dgn pola "validasi dulu baru tulis").
  // Precheck ini SELALU jalan apa pun syncSource-nya (larangan "jangan
  // recreate debt yg sudah dicicil" berlaku jg utk PC yg akan menulis
  // debts/debt_payments-nya sendiri lewat jalur lokal) -- lihat
  // checkDebtEditAllowed di debts/service.ts.
  const debtStatus = await getTransactionDebtStatus(env, id);
  try {
    checkDebtEditAllowed(debtStatus, fieldsChanged);
  } catch (err) {
    if (err instanceof DebtEditBlockedError) {
      return { status: "rejected", reason: err.message };
    }
    throw err;
  }

  if (await hasSourceRefConflict(env, id, payload)) {
    return { status: "rejected", reason: SOURCE_REF_CONFLICT_REASON };
  }

  // LWW menang CLEAR deleted_at juga, lihat account-groups/service.ts.
  // `source`/`source_ref` cuma ditimpa kalau payload EKSPLISIT kirim
  // `source` (?12 = 1) -- penulis lain (mis. MCP PATCH) yg tidak tahu
  // provenance tidak boleh menghapus jejak 'retailku_sync' yg sudah ada.
  await env.DB.prepare(
    `UPDATE transactions
     SET type = ?1, amount = ?2, category_id = ?3, account_id = ?4, transfer_account_id = ?5,
         note = ?6, date = ?7, description = ?8, contact_id = ?9, updated_at = ?10, deleted_at = NULL,
         source = CASE WHEN ?12 = 1 THEN ?13 ELSE source END,
         source_ref = CASE WHEN ?12 = 1 THEN ?14 ELSE source_ref END
     WHERE id = ?11`
  )
    .bind(
      payload.type,
      payload.amount,
      payload.type === "transfer" ? null : payload.categoryId ?? null,
      payload.accountId ?? null,
      payload.transferAccountId ?? null,
      payload.note,
      payload.date,
      payload.description ?? null,
      resolvedContactId,
      updatedAt,
      id,
      payload.source !== undefined ? 1 : 0,
      payload.source ?? "manual",
      payload.source !== undefined ? payload.sourceRef ?? null : null
    )
    .run();

  // syncSource !== 'pc': transaksi PC sudah py jalur tulis lokalnya
  // sendiri utk debts/debt_payments (apply-debt-transaction.ts, dipush
  // terpisah) -- bagian TULIS di sini (beda dari checkDebtEditAllowed
  // di atas yg SELALU jalan) khusus utk transaksi tanpa padanan lokal
  // (MCP). Lihat docs/todos/plan/fix-debts-duplikasi-sync.md.
  if (syncSource !== "pc") {
    const result = await applyDebtEditAction(env, {
      transactionId: id,
      type: payload.type,
      accountId: payload.accountId ?? "",
      transferAccountId: payload.transferAccountId ?? null,
      contactId: resolvedContactId,
      amount: payload.amount,
      date: payload.date,
      debtAction: payload.debtAction ?? null,
      settleDebtIds: payload.settleDebtIds ?? [],
      syncSource,
      status: debtStatus,
      dangerousFieldsChanged: fieldsChanged,
    });
    if (result.status === "rejected") return result;
  }

  return { status: "ok" };
}

export type DeleteTransactionResult =
  | { status: "ok"; debtInfo: DeletedTransactionDebtInfo }
  | { status: "not_found" };

// Soft delete, pola sama deleteAccount/deleteCategory/dst (`deleted_at`,
// BUKAN hard DELETE SQL). Tindakan thdp debt/debt_payments terkait
// TUNGGAL per role, tidak ada payload pilihan dari client -- lihat
// detachDebtForDeletedTransaction (debts/service.ts) utk detail
// lengkap tiap kasus & keputusan desain 2026-10-03.
export async function deleteTransaction(env: Env, id: string): Promise<DeleteTransactionResult> {
  const existing = await env.DB.prepare("SELECT id FROM transactions WHERE id = ?1 AND deleted_at IS NULL")
    .bind(id)
    .first<{ id: string }>();
  if (!existing) return { status: "not_found" };

  // Debt terkait diselesaikan SEBELUM soft-delete baris transaksi --
  // urutan tidak signifikan scr data (keduanya independen), tapi
  // konsisten dgn pola "resolve debt dulu baru commit transaksi" di
  // updateTransactionRow.
  const debtInfo = await detachDebtForDeletedTransaction(env, id);

  const now = nowText();
  await env.DB.prepare("UPDATE transactions SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2")
    .bind(now, id)
    .run();

  return { status: "ok", debtInfo };
}
