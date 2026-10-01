import type { Env } from "../../shared/env";
import type { PushTransactionPayload, PatchTransactionPayload } from "./schema";
import {
  applyDebtTransaction,
  applyDebtTransactionEdit,
  getTransactionDebtStatus,
  validateDebtSettlementAmount,
  DebtEditBlockedError,
} from "../debts/service";
import { nowText, resolveIncomingUpdatedAt, decideLww } from "../../shared/lww";

export type InsertTransactionResult =
  | { status: "ok" }
  | { status: "ignored" }
  | { status: "rejected"; reason: string };

export type UpdateTransactionResult =
  | { status: "ok" }
  | { status: "ignored" }
  | { status: "not_found" }
  | { status: "rejected"; reason: string };

// Logic bisnis #4 dari mcp-server-business-logic-audit.md, port dari
// apps/desktop/.../use-transaction-form.ts (proteksi via useEffect di
// form desktop). DI SINI harus jadi VALIDASI KERAS (reject), bukan
// auto-correct spt di form desktop -- Worker tidak punya UI utk
// "otomatis ganti pilihan user", cuma bisa terima atau tolak.
async function violatesDebtAccountRule(
  env: Env,
  payload: Pick<PushTransactionPayload, "type" | "accountId">
): Promise<boolean> {
  if (payload.type === "transfer") return false; // transfer boleh menyentuh akun debt
  if (!payload.accountId) return false;

  const row = await env.DB.prepare(
    "SELECT account_type FROM accounts WHERE id = ?1 AND deleted_at IS NULL"
  )
    .bind(payload.accountId)
    .first<{ account_type: string }>();

  return row?.account_type === "debt";
}

// UPSERT dgn LWW (lihat shared/lww.ts). `id` sudah ada di D1 -> delegasi
// ke updateTransactionRow (logic sama persis dgn jalur PATCH, krn
// semantiknya memang sama: "tulis baris ini kalau lebih baru dari yg
// ada"). LWW compare dicek PALING AWAL, SEBELUM validasi bisnis apa pun
// (#4, #3, dst) -- payload yg toh mau diabaikan tidak perlu divalidasi.
export async function insertTransaction(
  env: Env,
  payload: PushTransactionPayload
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
    const result = await updateTransactionRow(env, payload.id, payload, decision.updatedAt);
    if (result.status === "not_found") {
      // Tidak mungkin terjadi (existing sudah dicek barusan), tapi
      // dipertahankan sbg union type lengkap -- treat spt create gagal.
      return { status: "rejected", reason: "Transaction vanished during upsert" };
    }
    return result;
  }

  return createTransactionRow(env, payload, decision.updatedAt);
}

async function createTransactionRow(
  env: Env,
  payload: PushTransactionPayload,
  updatedAt: string
): Promise<InsertTransactionResult> {
  if (await violatesDebtAccountRule(env, payload)) {
    return {
      status: "rejected",
      reason: "Transaksi income/expense tidak boleh menyentuh akun bertipe 'debt' — gunakan transfer.",
    };
  }

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

  const now = nowText();
  await env.DB.prepare(
    `INSERT INTO transactions
       (id, type, amount, category_id, account_id, transfer_account_id,
        note, date, description, contact_id, created_at, updated_at, sync_source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pc')`
  )
    .bind(
      payload.id,
      payload.type,
      payload.amount,
      payload.categoryId ?? null,
      payload.accountId ?? null,
      payload.transferAccountId ?? null,
      payload.note,
      payload.date,
      payload.description ?? null,
      payload.contactId ?? null,
      now,
      updatedAt
    )
    .run();

  // Logic #1 (FIFO debt) -- PEMILIK-nya modul debts, dipanggil dari
  // sini sbg PEMICU krn butuh transactionId dari insert di atas. Lihat
  // apps/worker/docs/rules/module-structure.md. TIDAK bisa reject lagi
  // di titik ini krn logic #3 sudah dicek di atas sebelum insert.
  if (payload.type === "transfer" && payload.accountId) {
    await applyDebtTransaction(env, {
      transactionId: payload.id,
      type: payload.type,
      accountId: payload.accountId,
      transferAccountId: payload.transferAccountId ?? null,
      contactId: payload.contactId ?? null,
      amount: payload.amount,
      date: payload.date,
      debtAction: payload.debtAction ?? null,
      settleDebtIds: payload.settleDebtIds ?? [],
    });
  }

  return { status: "ok" };
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
  payload: PatchTransactionPayload
): boolean {
  return (
    payload.type !== existing.type ||
    (payload.accountId ?? null) !== existing.account_id ||
    (payload.transferAccountId ?? null) !== existing.transfer_account_id ||
    payload.amount !== existing.amount ||
    (payload.contactId ?? null) !== existing.contact_id
  );
}

// Endpoint PATCH /transactions/:id -- entry point publik, cek LWW +
// not_found SEBELUM delegasi ke updateTransactionRow (logic inti, jg
// dipakai dari insertTransaction saat id ternyata sudah ada -- lihat
// shared/lww.ts). LWW dicek PALING AWAL, SEBELUM validasi bisnis apa pun.
export async function updateTransaction(
  env: Env,
  id: string,
  payload: PatchTransactionPayload
): Promise<UpdateTransactionResult> {
  const existingMeta = await env.DB.prepare("SELECT updated_at FROM transactions WHERE id = ?1")
    .bind(id)
    .first<{ updated_at: string | null }>();
  if (!existingMeta) return { status: "not_found" };

  const incomingUpdatedAt = resolveIncomingUpdatedAt(payload.updatedAt);
  const decision = decideLww(incomingUpdatedAt, existingMeta.updated_at);
  if (decision.outcome === "stale") return { status: "ignored" };

  return updateTransactionRow(env, id, payload, decision.updatedAt);
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
  updatedAt: string
): Promise<UpdateTransactionResult> {
  const existing = await env.DB.prepare(
    "SELECT id, type, amount, account_id, transfer_account_id, contact_id FROM transactions WHERE id = ?1"
  )
    .bind(id)
    .first<ExistingTransactionRow>();
  if (!existing) return { status: "not_found" };

  if (await violatesDebtAccountRule(env, payload)) {
    return {
      status: "rejected",
      reason: "Transaksi income/expense tidak boleh menyentuh akun bertipe 'debt' — gunakan transfer.",
    };
  }

  const fieldsChanged = dangerousFieldsChanged(existing, payload);

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
  const debtStatus = await getTransactionDebtStatus(env, id);
  if (debtStatus.role === "principal" && fieldsChanged && debtStatus.hasPayments) {
    return {
      status: "rejected",
      reason: "Piutang/utang ini sudah menerima cicilan dari transaksi lain — nominal/akun/kontak tidak bisa diubah dari sini.",
    };
  }

  // LWW menang CLEAR deleted_at juga, lihat account-groups/service.ts.
  await env.DB.prepare(
    `UPDATE transactions
     SET type = ?1, amount = ?2, category_id = ?3, account_id = ?4, transfer_account_id = ?5,
         note = ?6, date = ?7, description = ?8, contact_id = ?9, updated_at = ?10, deleted_at = NULL
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
      payload.contactId ?? null,
      updatedAt,
      id
    )
    .run();

  try {
    const result = await applyDebtTransactionEdit(env, {
      transactionId: id,
      type: payload.type,
      accountId: payload.accountId ?? "",
      transferAccountId: payload.transferAccountId ?? null,
      contactId: payload.contactId ?? null,
      amount: payload.amount,
      date: payload.date,
      debtAction: payload.debtAction ?? null,
      settleDebtIds: payload.settleDebtIds ?? [],
      status: debtStatus,
      dangerousFieldsChanged: fieldsChanged,
    });
    if (result.status === "rejected") return result;
  } catch (err) {
    if (err instanceof DebtEditBlockedError) {
      return { status: "rejected", reason: err.message };
    }
    throw err;
  }

  return { status: "ok" };
}
