import type { Env } from "../../shared/env";
import type { SyncSource } from "../../shared/auth";
import type { CategoryPeriodPayload } from "./schema";
import { nowText, resolveIncomingUpdatedAt, decideLww } from "../../shared/lww";

export type UpsertCategoryPeriodResult = { status: "ok"; id: string } | { status: "stale" };

// Upsert-by-id MURNI, pola PERSIS pushDebtFromPc (debts/service.ts) --
// `id` dari payload (desktop generate uuidv7), LWW via `updatedAt`.
// SESUDAH upsert baris induk, REPLACE SELURUH pivot
// (category_period_categories WHERE period_id = ?): DELETE semua lalu
// INSERT ulang persis `payload.categoryIds`, bukan diff -- pola PERSIS
// desktop use-update-category-period.ts. `id` tiap pivot JUGA dari
// payload (BUKAN Worker generate), lihat catatan di schema.ts.
export async function upsertCategoryPeriod(
  env: Env,
  payload: CategoryPeriodPayload,
  syncSource: SyncSource
): Promise<UpsertCategoryPeriodResult> {
  const existing = await env.DB.prepare("SELECT updated_at FROM category_periods WHERE id = ?1")
    .bind(payload.id)
    .first<{ updated_at: string | null }>();

  const incomingUpdatedAt = resolveIncomingUpdatedAt(payload.updatedAt);
  const decision = decideLww(incomingUpdatedAt, existing?.updated_at ?? null);
  if (decision.outcome === "stale") return { status: "stale" };

  if (!existing) {
    const now = nowText();
    await env.DB.prepare(
      `INSERT INTO category_periods (id, name, start_date, end_date, created_at, updated_at, sync_source)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    )
      .bind(payload.id, payload.name, payload.startDate, payload.endDate, now, decision.updatedAt, syncSource)
      .run();
  } else {
    // LWW menang CLEAR deleted_at juga, pola account-groups/service.ts.
    await env.DB.prepare(
      `UPDATE category_periods
       SET name = ?1, start_date = ?2, end_date = ?3, updated_at = ?4, deleted_at = NULL
       WHERE id = ?5`
    )
      .bind(payload.name, payload.startDate, payload.endDate, decision.updatedAt, payload.id)
      .run();
  }

  await env.DB.prepare("DELETE FROM category_period_categories WHERE period_id = ?1")
    .bind(payload.id)
    .run();

  const now = nowText();
  for (const entry of payload.categoryIds) {
    await env.DB.prepare(
      `INSERT INTO category_period_categories
         (id, period_id, category_id, created_at, updated_at, sync_source)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    )
      .bind(entry.id, payload.id, entry.categoryId, now, decision.updatedAt, syncSource)
      .run();
  }

  return { status: "ok", id: payload.id };
}

export type DeleteCategoryPeriodResult = { status: "ok" } | { status: "not_found" };

// Soft-delete `category_periods` saja (pola account-groups/service.ts).
// Pivot TIDAK di-soft-delete manual terpisah -- `deleted_at` di induk
// sudah cukup utk query ringkasan/snapshot filter `deleted_at IS NULL`
// di induknya, lihat "Rencana pendekatan" di docs/todos/plan/category-period.md.
export async function deleteCategoryPeriod(env: Env, id: string): Promise<DeleteCategoryPeriodResult> {
  const existing = await env.DB.prepare("SELECT id FROM category_periods WHERE id = ?1 AND deleted_at IS NULL")
    .bind(id)
    .first<{ id: string }>();
  if (!existing) return { status: "not_found" };

  const now = nowText();
  await env.DB.prepare("UPDATE category_periods SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2")
    .bind(now, id)
    .run();
  return { status: "ok" };
}

export type CategoryPeriodSummary = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpense: number;
} | null;

// Ringkasan on-the-fly, match persis query desktop
// (useCategoryPeriodSummary) -- TIDAK disimpan/dicache, dihitung tiap
// panggil (sama prinsip accounts.balance).
export async function getCategoryPeriodSummary(env: Env, periodId: string): Promise<CategoryPeriodSummary> {
  const period = await env.DB.prepare(
    "SELECT id, name, start_date, end_date FROM category_periods WHERE id = ?1 AND deleted_at IS NULL"
  )
    .bind(periodId)
    .first<{ id: string; name: string; start_date: string; end_date: string }>();
  if (!period) return null;

  const totals = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS total_income,
       SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS total_expense
     FROM transactions
     WHERE category_id IN (
       SELECT category_id FROM category_period_categories
       WHERE period_id = ?1 AND deleted_at IS NULL
     )
     AND date BETWEEN ?2 AND ?3
     AND deleted_at IS NULL`
  )
    .bind(periodId, period.start_date, period.end_date)
    .first<{ total_income: number | null; total_expense: number | null }>();

  return {
    id: period.id,
    name: period.name,
    startDate: period.start_date,
    endDate: period.end_date,
    totalIncome: totals?.total_income ?? 0,
    totalExpense: totals?.total_expense ?? 0,
  };
}
