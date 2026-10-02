/**
 * Logic pull: terapkan `SyncResponse` dari Worker ke SQLite lokal
 * (lihat docs/todos/plan/mcp-server-cloud-mirror.md, "Logic pull").
 * Per baris per tabel: LWW compare `updatedAt` masuk vs `updated_at`
 * lokal (sama seperti `apps/worker/src/shared/lww.ts`) -- menang kalau
 * STRICT lebih baru, baris lokal diisi via trigger AFTER UPDATE +
 * backfill created_at (migrasi 0028), jadi perbandingan ini valid.
 *
 * `deletedAt` terisi dari Worker -> HARD DELETE lokal (keputusan sadar,
 * 2026-10-01): desktop TIDAK py satupun query yang filter
 * `deleted_at IS NULL`, jadi menyimpan soft-delete apa adanya akan
 * membuat baris "hidup tapi tersembunyi setengah2" di semua list/
 * laporan PC. Hard delete lokal konsisten dgn cara desktop sudah
 * bekerja (row yang dihapus beneran hilang).
 *
 * Urutan tabel MENGIKUTI dependency FK (account_groups/categories/
 * contacts dulu sebelum accounts/transactions yang mereferensikannya,
 * debts sebelum debt_payments).
 */

import type Database from "@tauri-apps/plugin-sql";

import { getDb } from "@/lib/db";
import type { SyncResponse, SyncRow } from "./worker-client";

async function getLocalUpdatedAt(
  db: Database,
  table: string,
  id: string
): Promise<string | null> {
  const rows = await db.select<{ updated_at: string | null }[]>(
    `SELECT updated_at FROM ${table} WHERE id = $1`,
    [id]
  );
  return rows[0]?.updated_at ?? null;
}

/** true kalau baris incoming MENANG (lebih baru ATAU belum ada lokal). */
function wins(incomingUpdatedAt: string | null, localUpdatedAt: string | null): boolean {
  if (incomingUpdatedAt === null) return false;
  if (localUpdatedAt === null) return true;
  return incomingUpdatedAt > localUpdatedAt;
}

async function applyRow<TRow extends SyncRow>(
  db: Database,
  table: string,
  row: TRow,
  upsert: (db: Database, row: TRow) => Promise<void>
): Promise<void> {
  const localUpdatedAt = await getLocalUpdatedAt(db, table, row.id);
  if (!wins(row.updatedAt, localUpdatedAt)) return;

  if (row.deletedAt !== null) {
    await db.execute(`DELETE FROM ${table} WHERE id = $1`, [row.id]);
    return;
  }

  await upsert(db, row);
}

async function upsertAccountGroup(db: Database, row: SyncResponse["accountGroups"][number]) {
  await db.execute(
    `INSERT INTO account_groups (id, name, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, NULL, 'mcp')
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at, deleted_at = NULL, sync_source = 'mcp'`,
    [row.id, row.name, row.updatedAt]
  );
}

async function upsertCategory(db: Database, row: SyncResponse["categories"][number]) {
  await db.execute(
    `INSERT INTO categories (id, name, icon, type, parent_id, is_active, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, 'mcp')
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, icon = excluded.icon, type = excluded.type,
       parent_id = excluded.parent_id, is_active = excluded.is_active, updated_at = excluded.updated_at,
       deleted_at = NULL, sync_source = 'mcp'`,
    [row.id, row.name, row.icon, row.type, row.parentId, Number(row.isActive), row.updatedAt]
  );
}

async function upsertContact(db: Database, row: SyncResponse["contacts"][number]) {
  await db.execute(
    `INSERT INTO contacts (id, name, note, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, $4, NULL, 'mcp')
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, note = excluded.note, updated_at = excluded.updated_at,
       deleted_at = NULL, sync_source = 'mcp'`,
    [row.id, row.name, row.note, row.updatedAt]
  );
}

async function upsertAccount(db: Database, row: SyncResponse["accounts"][number]) {
  await db.execute(
    `INSERT INTO accounts (id, name, icon, color, initial_balance, group_id, description, is_active, account_type, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, 'mcp')
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, icon = excluded.icon, color = excluded.color,
       initial_balance = excluded.initial_balance, group_id = excluded.group_id, description = excluded.description,
       is_active = excluded.is_active, account_type = excluded.account_type, updated_at = excluded.updated_at,
       deleted_at = NULL, sync_source = 'mcp'`,
    [
      row.id,
      row.name,
      row.icon,
      row.color,
      row.initialBalance,
      row.groupId,
      row.description,
      Number(row.isActive),
      row.accountType,
      row.updatedAt,
    ]
  );
}

/** true kalau (source, source_ref) baris incoming SUDAH dipakai baris
 * lokal lain (id beda) -- unique index `idx_*_source_ref` akan menolak
 * upsert-nya dan menggagalkan SELURUH pull. Kasus nyata: Retailku sync
 * jalan di 2 PC, baris yg sama punya id beda tapi source_ref sama. Baris
 * lokal dipertahankan, incoming dilewati (bukan dobel). */
async function hasLocalSourceRefConflict(
  db: Database,
  table: "transactions" | "debts" | "debt_payments",
  row: { id: string; source: string; sourceRef: string | null }
): Promise<boolean> {
  if (!row.sourceRef) return false;
  const rows = await db.select<{ id: string }[]>(
    `SELECT id FROM ${table} WHERE source = $1 AND source_ref = $2 AND id <> $3 LIMIT 1`,
    [row.source, row.sourceRef, row.id]
  );
  return rows.length > 0;
}

async function upsertTransaction(db: Database, row: SyncResponse["transactions"][number]) {
  if (await hasLocalSourceRefConflict(db, "transactions", row)) return;
  await db.execute(
    `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date, contact_id, source, source_ref, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NULL, 'mcp')
     ON CONFLICT(id) DO UPDATE SET type = excluded.type, amount = excluded.amount, category_id = excluded.category_id,
       account_id = excluded.account_id, transfer_account_id = excluded.transfer_account_id, note = excluded.note,
       description = excluded.description, date = excluded.date, contact_id = excluded.contact_id,
       source = excluded.source, source_ref = excluded.source_ref,
       updated_at = excluded.updated_at, deleted_at = NULL, sync_source = 'mcp'`,
    [
      row.id,
      row.type,
      row.amount,
      row.categoryId,
      row.accountId,
      row.transferAccountId,
      row.note,
      row.description,
      row.date,
      row.contactId,
      row.source,
      row.sourceRef,
      row.updatedAt,
    ]
  );
}

// `debts`/`debt_payments` di D1 DITURUNKAN Worker sendiri dari transaksi
// (applyDebtTransaction), belum ada jalur push provenance-nya -- jadi
// 'manual' dari Worker belum tentu benar. Cabang UPDATE hanya menimpa
// `source`/`source_ref` kalau incoming 'retailku_sync'; jejak Retailku
// lokal tidak boleh dihapus oleh 'manual' default dari cloud.
async function upsertDebt(db: Database, row: SyncResponse["debts"][number]) {
  if (await hasLocalSourceRefConflict(db, "debts", row)) return;
  await db.execute(
    `INSERT INTO debts (id, type, contact_id, amount, account_id, transaction_id, status, note, date, source, source_ref, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NULL, 'mcp')
     ON CONFLICT(id) DO UPDATE SET type = excluded.type, contact_id = excluded.contact_id, amount = excluded.amount,
       account_id = excluded.account_id, transaction_id = excluded.transaction_id, status = excluded.status,
       note = excluded.note, date = excluded.date,
       source = CASE WHEN excluded.source = 'retailku_sync' THEN excluded.source ELSE debts.source END,
       source_ref = CASE WHEN excluded.source = 'retailku_sync' THEN excluded.source_ref ELSE debts.source_ref END,
       updated_at = excluded.updated_at, deleted_at = NULL, sync_source = 'mcp'`,
    [
      row.id,
      row.type,
      row.contactId,
      row.amount,
      row.accountId,
      row.transactionId,
      row.status,
      row.note,
      row.date,
      row.source,
      row.sourceRef,
      row.updatedAt,
    ]
  );
}

async function upsertDebtPayment(db: Database, row: SyncResponse["debtPayments"][number]) {
  if (await hasLocalSourceRefConflict(db, "debt_payments", row)) return;
  await db.execute(
    `INSERT INTO debt_payments (id, debt_id, amount, account_id, transaction_id, note, date, source, source_ref, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, 'mcp')
     ON CONFLICT(id) DO UPDATE SET debt_id = excluded.debt_id, amount = excluded.amount, account_id = excluded.account_id,
       transaction_id = excluded.transaction_id, note = excluded.note, date = excluded.date,
       source = CASE WHEN excluded.source = 'retailku_sync' THEN excluded.source ELSE debt_payments.source END,
       source_ref = CASE WHEN excluded.source = 'retailku_sync' THEN excluded.source_ref ELSE debt_payments.source_ref END,
       updated_at = excluded.updated_at, deleted_at = NULL, sync_source = 'mcp'`,
    [
      row.id,
      row.debtId,
      row.amount,
      row.accountId,
      row.transactionId,
      row.note,
      row.date,
      row.source,
      row.sourceRef,
      row.updatedAt,
    ]
  );
}

/** Terapkan SEMUA baris dari satu `SyncResponse` ke SQLite lokal, urut
 * sesuai dependency FK. Caller bertanggung jawab update checkpoint
 * (`useSetCloudSyncCheckpoint`) SETELAH ini resolve sukses. */
export async function applySyncResponse(response: SyncResponse): Promise<void> {
  const db = await getDb();

  for (const row of response.accountGroups) await applyRow(db, "account_groups", row, upsertAccountGroup);
  for (const row of response.categories) await applyRow(db, "categories", row, upsertCategory);
  for (const row of response.contacts) await applyRow(db, "contacts", row, upsertContact);
  for (const row of response.accounts) await applyRow(db, "accounts", row, upsertAccount);
  for (const row of response.transactions) await applyRow(db, "transactions", row, upsertTransaction);
  for (const row of response.debts) await applyRow(db, "debts", row, upsertDebt);
  for (const row of response.debtPayments) await applyRow(db, "debt_payments", row, upsertDebtPayment);
}
