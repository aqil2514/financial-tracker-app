import { uuidv7 } from "uuidv7";
import type { Env } from "../../shared/env";

type OngoingDebtRow = { id: string; remaining: number };

export type ApplyDebtTransactionInput = {
  transactionId: string;
  type: "income" | "expense" | "transfer";
  accountId: string;
  // Hanya terisi untuk type === 'transfer'.
  transferAccountId: string | null;
  contactId: string | null;
  amount: number;
  date: string;
  // Hanya relevan saat arah transfer adalah debt->cash (ambigu antara
  // pelunasan piutang existing vs utang baru).
  debtAction: "settlement" | "payable" | null;
  // debts.id yang dipilih utk dilunasi -- cuma dipakai saat
  // debtAction === 'settlement'.
  settleDebtIds: string[];
};

async function getAccountType(env: Env, accountId: string): Promise<string | null> {
  const row = await env.DB.prepare(
    "SELECT account_type FROM accounts WHERE id = ?1 AND deleted_at IS NULL"
  )
    .bind(accountId)
    .first<{ account_type: string }>();
  return row?.account_type ?? null;
}

// Logic bisnis #1 dari mcp-server-business-logic-audit.md, port PERSIS
// dari apps/desktop/src/shared/debts/apply-debt-transaction.ts
// (applyDebtTransaction). Setelah baris `transactions` tersimpan,
// deteksi apakah transfer ini melibatkan akun `account_type='debt'`
// dan buat/update `debts`/`debt_payments` sesuai arah:
// - cash -> debt: piutang baru (type='receivable').
// - debt -> cash: WAJIB `debtAction` eksplisit -- 'payable' (utang
//   baru) atau 'settlement' (lunasi piutang existing, FIFO).
// - debt -> debt / cash -> cash: no-op (di luar scope).
//
// BEDA dari desktop: modul ini adalah PEMILIK logic (dipanggil dari
// transactions/service.ts sbg PEMICU, lihat
// apps/worker/docs/rules/module-structure.md "Logic bisnis lintas-modul").
export async function applyDebtTransaction(env: Env, input: ApplyDebtTransactionInput): Promise<void> {
  const { transactionId, type, accountId, transferAccountId, contactId, amount, date, debtAction, settleDebtIds } =
    input;

  if (type !== "transfer" || transferAccountId == null) return;

  const [sourceType, destinationType] = await Promise.all([
    getAccountType(env, accountId),
    getAccountType(env, transferAccountId),
  ]);

  const sourceIsDebt = sourceType === "debt";
  const destinationIsDebt = destinationType === "debt";

  if (sourceIsDebt === destinationIsDebt) {
    // "kas -> kas" (bukan urusan debt) ATAU "debt -> debt" (di luar
    // scope) -- tidak melakukan apa-apa.
    return;
  }

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  if (destinationIsDebt) {
    // Kas -> Debt: piutang baru, tidak ambigu.
    await env.DB.prepare(
      `INSERT INTO debts
         (id, type, contact_id, amount, account_id, transaction_id, date, created_at, updated_at, sync_source)
       VALUES (?1, 'receivable', ?2, ?3, ?4, ?5, ?6, ?7, ?7, 'mcp')`
    )
      .bind(uuidv7(), contactId, amount, transferAccountId, transactionId, date, now)
      .run();
    return;
  }

  // Debt -> Kas: butuh keputusan eksplisit dari caller.
  if (debtAction === "payable") {
    await env.DB.prepare(
      `INSERT INTO debts
         (id, type, contact_id, amount, account_id, transaction_id, date, created_at, updated_at, sync_source)
       VALUES (?1, 'payable', ?2, ?3, ?4, ?5, ?6, ?7, ?7, 'mcp')`
    )
      .bind(uuidv7(), contactId, amount, accountId, transactionId, date, now)
      .run();
    return;
  }

  if (debtAction === "settlement") {
    await settleDebtsFifo(env, { transactionId, accountId, amount, date, settleDebtIds });
  }
}

async function settleDebtsFifo(
  env: Env,
  {
    transactionId,
    accountId,
    amount,
    date,
    settleDebtIds,
  }: {
    transactionId: string;
    accountId: string;
    amount: number;
    date: string;
    settleDebtIds: string[];
  }
): Promise<void> {
  if (settleDebtIds.length === 0) return;

  const placeholders = settleDebtIds.map((_, i) => `?${i + 1}`).join(", ");
  const { results: debts } = await env.DB.prepare(
    `SELECT
       debts.id,
       debts.amount - COALESCE(
         (SELECT SUM(amount) FROM debt_payments WHERE debt_payments.debt_id = debts.id),
         0
       ) AS remaining
     FROM debts
     WHERE debts.id IN (${placeholders}) AND debts.deleted_at IS NULL
     ORDER BY debts.date ASC, debts.id ASC`
  )
    .bind(...settleDebtIds)
    .all<OngoingDebtRow>();

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  let remainingToAllocate = amount;
  for (const debt of debts) {
    if (remainingToAllocate <= 0) break;
    const allocation = Math.min(debt.remaining, remainingToAllocate);
    if (allocation <= 0) continue;

    await env.DB.prepare(
      `INSERT INTO debt_payments
         (id, debt_id, amount, account_id, transaction_id, date, created_at, updated_at, sync_source)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, 'mcp')`
    )
      .bind(uuidv7(), debt.id, allocation, accountId, transactionId, date, now)
      .run();

    if (allocation >= debt.remaining) {
      await env.DB.prepare("UPDATE debts SET status = 'paid' WHERE id = ?1").bind(debt.id).run();
    }

    remainingToAllocate -= allocation;
  }
}
