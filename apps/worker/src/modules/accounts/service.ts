import { uuidv7 } from "uuidv7";
import type { Env } from "../../shared/env";
import type { SyncSource } from "../../shared/auth";
import type { AccountPayload, DeleteAccountPayload } from "./schema";
import { nowText, resolveIncomingUpdatedAt, decideLww } from "../../shared/lww";

const CORRECTION_CATEGORY_NAME = "Penyesuaian Saldo";

export type UpsertAccountResult =
  | { status: "ok"; id: string }
  | { status: "stale" }
  | { status: "rejected"; reason: string };

// Prinsip #3 docs/concept/konsep-tipe-akun.md ("tipe akun permanen
// setelah dipakai") -- lihat audit-kepatuhan-konsep-tipe-akun.md
// pertanyaan #5: SEBELUM perubahan ini, guard ini TIDAK ADA di lapisan
// manapun (desktop/Worker/MCP). "Dipakai" = ada baris TIDAK terhapus di
// salah satu dari 3 tabel finansial yg FK ke accounts (transactions via
// account_id ATAU transfer_account_id, debts, debt_payments) --
// retailku_sync_field_mapping SENGAJA tidak dihitung, itu konfigurasi
// mapping bukan histori transaksi (keputusan 2026-10-03).
async function isAccountInUse(env: Env, accountId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT EXISTS(
       SELECT 1 FROM transactions
       WHERE (account_id = ?1 OR transfer_account_id = ?1) AND deleted_at IS NULL
       UNION ALL
       SELECT 1 FROM debts WHERE account_id = ?1 AND deleted_at IS NULL
       UNION ALL
       SELECT 1 FROM debt_payments WHERE account_id = ?1 AND deleted_at IS NULL
     ) AS used`
  )
    .bind(accountId)
    .first<{ used: number }>();
  return row?.used === 1;
}

// UPSERT dgn LWW, port dari use-create-account.ts + use-update-account.ts
// digabung (lihat shared/lww.ts).
export async function upsertAccount(
  env: Env,
  payload: AccountPayload,
  syncSource: SyncSource
): Promise<UpsertAccountResult> {
  const existing = await env.DB.prepare("SELECT updated_at, account_type FROM accounts WHERE id = ?1")
    .bind(payload.id)
    .first<{ updated_at: string | null; account_type: string }>();

  const incomingUpdatedAt = resolveIncomingUpdatedAt(payload.updatedAt);
  const decision = decideLww(incomingUpdatedAt, existing?.updated_at ?? null);
  if (decision.outcome === "stale") return { status: "stale" };

  // Guard SEBELUM tulis -- hanya relevan kalau account_type BERUBAH dari
  // nilai existing (payload selalu kirim objek penuh, bukan partial,
  // jadi caller yg tidak sengaja mengubah tipe tetap kirim nilai lama
  // yg identik dan lolos tanpa perlu query isAccountInUse).
  if (existing && payload.accountType !== existing.account_type && (await isAccountInUse(env, payload.id))) {
    return {
      status: "rejected",
      reason:
        "Tipe akun tidak bisa diubah karena akun ini sudah punya transaksi/piutang-utang terkait.",
    };
  }

  if (!existing) {
    const now = nowText();
    await env.DB.prepare(
      `INSERT INTO accounts
         (id, name, icon, initial_balance, group_id, description, is_active, account_type, color,
          created_at, updated_at, sync_source)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
    )
      .bind(
        payload.id,
        payload.name,
        payload.icon ?? null,
        payload.initialBalance,
        payload.groupId ?? null,
        payload.description ?? null,
        payload.isActive === false ? 0 : 1,
        payload.accountType,
        payload.color ?? null,
        now,
        decision.updatedAt,
        syncSource
      )
      .run();
  } else {
    // LWW menang CLEAR deleted_at juga, lihat account-groups/service.ts.
    await env.DB.prepare(
      `UPDATE accounts
       SET name = ?1, icon = ?2, initial_balance = ?3, group_id = ?4, description = ?5,
           is_active = ?6, account_type = ?7, color = ?8, updated_at = ?9, deleted_at = NULL
       WHERE id = ?10`
    )
      .bind(
        payload.name,
        payload.icon ?? null,
        payload.initialBalance,
        payload.groupId ?? null,
        payload.description ?? null,
        payload.isActive === false ? 0 : 1,
        payload.accountType,
        payload.color ?? null,
        decision.updatedAt,
        payload.id
      )
      .run();
  }

  return { status: "ok", id: payload.id };
}

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
  targetBalance: number,
  syncSource: SyncSource
): Promise<CorrectAccountBalanceResult> {
  const currentBalance = await getAccountBalance(env, accountId);
  if (currentBalance === null) return { status: "account_not_found" };

  const diff = targetBalance - currentBalance;
  if (diff === 0) return { status: "no_change" }; // no-op, sama persis spt desktop

  const type: "income" | "expense" = diff > 0 ? "income" : "expense";
  const amount = Math.abs(diff);

  const categoryId = await getOrCreateCorrectionCategoryId(env, type, syncSource);

  // sync_source derive dari token request (requireAuth), BUKAN dari body
  // payload client -- lihat shared/auth.ts resolveSyncSource.
  const transactionId = uuidv7();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  await env.DB.prepare(
    `INSERT INTO transactions
       (id, type, amount, category_id, account_id, note, date, created_at, updated_at, sync_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?7, ?8)`
  )
    .bind(transactionId, type, amount, categoryId, accountId, "Koreksi saldo", now, syncSource)
    .run();

  return { status: "corrected", transactionId };
}

export type DeleteAccountResult = { status: "ok" } | { status: "not_found" };

// Port dari use-delete-account.ts, soft delete versi Worker (lihat
// catatan soft-delete di account-groups/service.ts -- alasan sama:
// desktop hard DELETE + FK SET NULL, Worker SET deleted_at krn tidak
// benar2 menghapus baris). Akun dipakai di DUA kolom transactions
// (account_id DAN transfer_account_id) -- keduanya di-UPDATE bareng,
// PERSIS urutan desktop.
export async function deleteAccount(
  env: Env,
  id: string,
  payload: DeleteAccountPayload
): Promise<DeleteAccountResult> {
  const existing = await env.DB.prepare("SELECT id FROM accounts WHERE id = ?1 AND deleted_at IS NULL")
    .bind(id)
    .first<{ id: string }>();
  if (!existing) return { status: "not_found" };

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  if (payload.transactionAction === "unassign") {
    await env.DB.prepare("UPDATE transactions SET account_id = NULL, updated_at = ?1 WHERE account_id = ?2")
      .bind(now, id)
      .run();
    await env.DB.prepare(
      "UPDATE transactions SET transfer_account_id = NULL, updated_at = ?1 WHERE transfer_account_id = ?2"
    )
      .bind(now, id)
      .run();
  } else if (payload.transactionAction === "reassign" && payload.targetAccountId != null) {
    await env.DB.prepare("UPDATE transactions SET account_id = ?1, updated_at = ?2 WHERE account_id = ?3")
      .bind(payload.targetAccountId, now, id)
      .run();
    await env.DB.prepare(
      "UPDATE transactions SET transfer_account_id = ?1, updated_at = ?2 WHERE transfer_account_id = ?3"
    )
      .bind(payload.targetAccountId, now, id)
      .run();
  }

  await env.DB.prepare("UPDATE accounts SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2")
    .bind(now, id)
    .run();
  return { status: "ok" };
}

async function getOrCreateCorrectionCategoryId(
  env: Env,
  type: "income" | "expense",
  syncSource: SyncSource
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
     VALUES (?1, ?2, ?3, 1, ?4, ?4, ?5)`
  )
    .bind(id, CORRECTION_CATEGORY_NAME, type, now, syncSource)
    .run();
  return id;
}
