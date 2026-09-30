import type { Env } from "../../shared/env";
import type { PushTransactionPayload } from "./schema";
import { applyDebtTransaction } from "../debts/service";

export type InsertTransactionResult =
  | { status: "ok" }
  | { status: "rejected"; reason: string };

// Logic bisnis #4 dari mcp-server-business-logic-audit.md, port dari
// apps/desktop/.../use-transaction-form.ts (proteksi via useEffect di
// form desktop). DI SINI harus jadi VALIDASI KERAS (reject), bukan
// auto-correct spt di form desktop -- Worker tidak punya UI utk
// "otomatis ganti pilihan user", cuma bisa terima atau tolak.
async function violatesDebtAccountRule(
  env: Env,
  payload: PushTransactionPayload
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

// SENGAJA belum lengkap: logic #2/#3 (guard edit, validasi pelunasan)
// blm relevan di sini (fungsi ini cuma create, bukan update). Belum
// UPSERT dgn LWW (`updated_at` selalu ditulis baru, blm dibandingkan
// dgn baris existing) -- lihat checklist sisa di
// docs/todos/plan/mcp-server-business-logic-audit.md.
export async function insertTransaction(
  env: Env,
  payload: PushTransactionPayload
): Promise<InsertTransactionResult> {
  if (await violatesDebtAccountRule(env, payload)) {
    return {
      status: "rejected",
      reason: "Transaksi income/expense tidak boleh menyentuh akun bertipe 'debt' — gunakan transfer.",
    };
  }

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
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
      now
    )
    .run();

  // Logic #1 (FIFO debt) -- PEMILIK-nya modul debts, dipanggil dari
  // sini sbg PEMICU krn butuh transactionId dari insert di atas. Lihat
  // apps/worker/docs/rules/module-structure.md.
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
