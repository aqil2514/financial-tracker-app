import { uuidv7 } from "uuidv7";
import type { Env } from "../../shared/env";

const CORRECTION_CATEGORY_NAME = "Penyesuaian Saldo";

// Logic bisnis #5 (formula saldo akun) dari
// docs/todos/plan/mcp-server-business-logic-audit.md, port PERSIS dari
// apps/desktop/src/hooks/resources/use-accounts.ts
// (SELECT_ACCOUNTS_WITH_BALANCE) -- TIDAK ADA kolom `balance` tersimpan
// di mana pun, harus dihitung ulang tiap kali. Arah tanda WAJIB sama
// persis: +income, -expense, -transfer (account_id = akun ini),
// +transfer (transfer_account_id = akun ini).
//
// BEDA dari query asli desktop: filter `deleted_at IS NULL` ditambah
// di sini SEJAK AWAL meski soft delete belum dipakai di kode manapun
// sekarang (2026-09-30) -- aman krn semua baris deleted_at-nya NULL
// saat ini (hasil query sama persis), tapi begitu Tahap 6 mulai
// soft-delete data, formula ini otomatis benar tanpa perlu diingat lagi.
//
// TIDAK ADA larangan saldo negatif (disengaja, sama dgn desktop) --
// JANGAN tambahkan constraint `balance >= 0` di D1.
export async function getAccountBalance(env: Env, accountId: string): Promise<number | null> {
  const row = await env.DB.prepare(
    `SELECT
       a.initial_balance
       + COALESCE((
           SELECT SUM(
             CASE
               WHEN t.type = 'income' THEN t.amount
               WHEN t.type = 'expense' THEN -t.amount
               WHEN t.type = 'transfer' THEN -t.amount
               ELSE 0
             END
           )
           FROM transactions t
           WHERE t.account_id = a.id AND t.deleted_at IS NULL
         ), 0)
       + COALESCE((
           SELECT SUM(t.amount)
           FROM transactions t
           WHERE t.type = 'transfer' AND t.transfer_account_id = a.id AND t.deleted_at IS NULL
         ), 0) AS balance
     FROM accounts a
     WHERE a.id = ?1 AND a.deleted_at IS NULL`
  )
    .bind(accountId)
    .first<{ balance: number }>();

  return row?.balance ?? null;
}

// Logic bisnis #6 (koreksi saldo manual) dari
// docs/todos/plan/mcp-server-business-logic-audit.md, port dari
// apps/desktop/.../use-correct-account-balance.ts. BEDA dari desktop:
// desktop terima `currentBalance` dari cache client (sudah dihitung
// sebelumnya) -- Worker TIDAK BOLEH percaya nilai itu dari luar (bisa
// salah/basi), jadi dihitung ulang sendiri di sini via getAccountBalance().
export type CorrectAccountBalanceResult =
  | { status: "account_not_found" }
  | { status: "no_change" }
  | { status: "corrected"; transactionId: string };

export async function correctAccountBalance(
  env: Env,
  accountId: string,
  targetBalance: number
): Promise<CorrectAccountBalanceResult> {
  const currentBalance = await getAccountBalance(env, accountId);
  if (currentBalance === null) return { status: "account_not_found" };

  const diff = targetBalance - currentBalance;
  if (diff === 0) return { status: "no_change" }; // no-op, sama persis spt desktop

  const type: "income" | "expense" = diff > 0 ? "income" : "expense";
  const amount = Math.abs(diff);

  const categoryId = await getOrCreateCorrectionCategoryId(env, type);

  // TODO(sync_source): hardcode 'mcp' krn endpoint ini dianggap dipanggil
  // dari luar PC (bukan hasil push /transactions dari PC). SEMENTARA --
  // begitu token MCP terpisah dari PC_SYNC_TOKEN sudah ada (lihat
  // "Yang belum diputuskan" di apps/worker/docs/todos/plan/cloud-sync.md),
  // ganti jadi derive dari jenis token yg dipakai request ini, JANGAN
  // percaya sync_source dari body payload client (bisa dipalsukan).
  const transactionId = uuidv7();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  await env.DB.prepare(
    `INSERT INTO transactions
       (id, type, amount, category_id, account_id, note, date, created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?7, 'mcp')`
  )
    .bind(transactionId, type, amount, categoryId, accountId, "Koreksi saldo", now)
    .run();

  return { status: "corrected", transactionId };
}

async function getOrCreateCorrectionCategoryId(
  env: Env,
  type: "income" | "expense"
): Promise<string> {
  const existing = await env.DB.prepare(
    "SELECT id FROM categories WHERE name = ?1 AND type = ?2 AND deleted_at IS NULL LIMIT 1"
  )
    .bind(CORRECTION_CATEGORY_NAME, type)
    .first<{ id: string }>();
  if (existing) return existing.id;

  const id = uuidv7();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  await env.DB.prepare(
    `INSERT INTO categories (id, name, type, is_active, created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, 1, ?4, ?4, 'mcp')`
  )
    .bind(id, CORRECTION_CATEGORY_NAME, type, now)
    .run();
  return id;
}
