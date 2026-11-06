import { beforeEach, describe, expect, it } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import { createSqliteTestDb } from "@/lib/database/testing/sqlite-test-db";
import { buildWhereClause } from "@/components/query/filters/builders/sql";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import { applyEntityLabels, loadEntityLabelNames } from "./entity-labels";
import { extractLabelCondition } from "./extract-label-condition";
import { EFFECTIVE_LABELS_SQL, splitEffectiveLabels } from "./effective-labels";

describe("applyEntityLabels", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await createSqliteTestDb();
    await db.runAsync("INSERT INTO accounts (id, name) VALUES ('a1', 'Kas')");
    await db.runAsync("INSERT INTO categories (id, name, type) VALUES ('c1', 'Makan', 'expense')");
  });

  it("membuat label baru di scope yang benar dan memasangnya", async () => {
    await applyEntityLabels(db, "account", "a1", ["Pribadi"]);
    await applyEntityLabels(db, "category", "c1", ["Rutin"]);

    expect(await db.getAllAsync("SELECT name, scope FROM labels ORDER BY name")).toEqual([
      { name: "Pribadi", scope: "account" },
      { name: "Rutin", scope: "transaction_category" },
    ]);
    expect(await loadEntityLabelNames(db, "account", "a1")).toEqual(["Pribadi"]);
  });

  it("memakai label yang sudah ada tanpa membedakan huruf besar/kecil, dan membuang duplikat input", async () => {
    await db.runAsync("INSERT INTO labels (id, name, scope) VALUES ('l1', 'Liburan', 'account')");
    await applyEntityLabels(db, "account", "a1", ["liburan", "LIBURAN", "  "]);

    expect(await db.getAllAsync("SELECT id FROM labels")).toEqual([{ id: "l1" }]);
    expect(await db.getAllAsync("SELECT label_id FROM account_labels")).toEqual([{ label_id: "l1" }]);
  });

  it("diff: pemasangan yang tidak berubah tidak disentuh, yang dibuang dihapus", async () => {
    await applyEntityLabels(db, "account", "a1", ["A", "B"]);
    await db.runAsync("DELETE FROM cloud_sync_queue");

    await applyEntityLabels(db, "account", "a1", ["B", "C"]);

    expect(await loadEntityLabelNames(db, "account", "a1")).toEqual(["B", "C"]);
    const queued = await db.getAllAsync<{ table_name: string; op: string }>(
      "SELECT table_name, op FROM cloud_sync_queue WHERE table_name = 'account_labels' ORDER BY op"
    );
    expect(queued).toEqual([
      { table_name: "account_labels", op: "delete" },
      { table_name: "account_labels", op: "upsert" },
    ]);
  });
});

describe("extractLabelCondition", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await createSqliteTestDb();
    await db.runAsync("INSERT INTO accounts (id, name) VALUES ('a1', 'Kas')");
    await db.runAsync("INSERT INTO categories (id, name, type) VALUES ('c1', 'Makan', 'expense')");
    await db.runAsync("INSERT INTO labels (id, name, scope) VALUES ('lA', 'Konsumtif', 'transaction_category'), ('lB', 'Produktif', 'transaction_category')");
    await db.runAsync("INSERT INTO category_labels (id, category_id, label_id) VALUES ('cl1', 'c1', 'lA')");
    // t1: label sendiri (Produktif) menang atas label kategori; t2: kosong, fallback ke kategori (Konsumtif);
    // t3: tanpa label dan tanpa kategori.
    const insert = "INSERT INTO transactions (id, note, type, amount, date, account_id, category_id) VALUES (?, 'n', 'expense', 1, '2026-11-01T10:00', 'a1', ?)";
    await db.runAsync(insert, ["t1", "c1"]);
    await db.runAsync(insert, ["t2", "c1"]);
    await db.runAsync(insert, ["t3", null]);
    await db.runAsync("INSERT INTO transaction_labels (id, transaction_id, label_id) VALUES ('tl1', 't1', 'lB')");
  });

  async function ids(filters: FilterConfig[]) {
    const { remaining, extraConditions } = extractLabelCondition(filters);
    const { whereClause, params } = buildWhereClause(remaining, ["note", "type"], extraConditions);
    const sql = `SELECT id FROM transactions ${whereClause.replace(/\$\d+/g, "?")} ORDER BY id`;
    return (await db.getAllAsync<{ id: string }>(sql, params)).map((row) => row.id);
  }

  const label = (filterOperator: FilterConfig["filterOperator"], filterValue: FilterConfig["filterValue"]): FilterConfig => ({
    filterKey: "label",
    filterOperator,
    filterValue,
  });

  it("Adalah: label sendiri menang, kosong jatuh ke label kategori", async () => {
    expect(await ids([label("eq", ["Produktif"])])).toEqual(["t1"]);
    expect(await ids([label("eq", ["Konsumtif"])])).toEqual(["t2"]);
  });

  it("beberapa nama = salah satu cocok", async () => {
    expect(await ids([label("eq", ["Konsumtif", "Produktif"])])).toEqual(["t1", "t2"]);
  });

  it("Bukan, Kosong, dan Tidak kosong", async () => {
    expect(await ids([label("neq", ["Produktif"])])).toEqual(["t2", "t3"]);
    expect(await ids([label("is_null", null)])).toEqual(["t3"]);
    expect(await ids([label("is_not_null", null)])).toEqual(["t1", "t2"]);
  });

  it("digabung dengan filter kolom lain, urutan parameter tetap benar", async () => {
    const note: FilterConfig = { filterKey: "note", filterOperator: "ilike", filterValue: "n" };
    expect(await ids([note, label("eq", ["Konsumtif"])])).toEqual(["t2"]);
  });
});

describe("EFFECTIVE_LABELS_SQL", () => {
  it("label sendiri menang, kosong jatuh ke kategori, nama dengan koma tetap utuh dan terurut", async () => {
    const db = await createSqliteTestDb();
    await db.runAsync("INSERT INTO accounts (id, name) VALUES ('a1', 'Kas')");
    await db.runAsync("INSERT INTO categories (id, name, type) VALUES ('c1', 'Makan', 'expense')");
    await db.runAsync(
      "INSERT INTO labels (id, name, scope) VALUES ('l1', 'Beli, Jual', 'transaction_category'), ('l2', 'Awal', 'transaction_category'), ('l3', 'Kategori', 'transaction_category')"
    );
    await db.runAsync("INSERT INTO category_labels (id, category_id, label_id) VALUES ('cl', 'c1', 'l3')");
    const insert = "INSERT INTO transactions (id, note, type, amount, date, account_id, category_id) VALUES (?, 'n', 'expense', 1, '2026-11-01T10:00', 'a1', ?)";
    await db.runAsync(insert, ["t1", "c1"]);
    await db.runAsync(insert, ["t2", "c1"]);
    await db.runAsync(insert, ["t3", null]);
    await db.runAsync(
      "INSERT INTO transaction_labels (id, transaction_id, label_id) VALUES ('x1', 't1', 'l1'), ('x2', 't1', 'l2')"
    );

    const rows = await db.getAllAsync<{ id: string; raw: string | null }>(
      `SELECT id, ${EFFECTIVE_LABELS_SQL} AS raw FROM transactions ORDER BY id`
    );
    const byId = Object.fromEntries(rows.map((row) => [row.id, splitEffectiveLabels(row.raw)]));
    expect(byId).toEqual({ t1: ["Awal", "Beli, Jual"], t2: ["Kategori"], t3: [] });
  });
});
