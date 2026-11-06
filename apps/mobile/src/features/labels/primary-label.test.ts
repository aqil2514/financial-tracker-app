import { beforeEach, describe, expect, it } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import { createSqliteTestDb } from "@/lib/database/testing/sqlite-test-db";
import { primaryLabelSql } from "./primary-label";

const PRIMARY = primaryLabelSql("transactions");

describe("primaryLabelSql", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await createSqliteTestDb();
    await db.runAsync("INSERT INTO accounts (id, name) VALUES ('a1', 'Kas')");
    await db.runAsync("INSERT INTO categories (id, name, type) VALUES ('c1', 'Makan', 'expense')");
    await db.runAsync(
      `INSERT INTO labels (id, name, scope) VALUES
         ('lK', 'Konsumtif', 'transaction_category'),
         ('lP', 'Produktif', 'transaction_category'),
         ('lA', 'Awal', 'transaction_category')`
    );
    await db.runAsync("INSERT INTO category_labels (id, category_id, label_id) VALUES ('cl1', 'c1', 'lK')");

    const insert =
      "INSERT INTO transactions (id, note, type, amount, date, account_id, category_id) VALUES (?, 'n', 'expense', ?, '2026-11-01T10:00', 'a1', ?)";
    await db.runAsync(insert, ["t1", 100, "c1"]); // label sendiri 2 buah: Produktif, Awal
    await db.runAsync(insert, ["t2", 50, "c1"]); // kosong: fallback kategori (Konsumtif)
    await db.runAsync(insert, ["t3", 7, null]); // tanpa label dan tanpa kategori
    await db.runAsync(
      "INSERT INTO transaction_labels (id, transaction_id, label_id) VALUES ('x1', 't1', 'lP'), ('x2', 't1', 'lA')"
    );
  });

  it("satu label per transaksi: label sendiri menang, yang pertama secara alfabet; kosong jatuh ke kategori", async () => {
    const rows = await db.getAllAsync<{ id: string; label: string | null }>(
      `SELECT id, ${PRIMARY} AS label FROM transactions ORDER BY id`
    );
    expect(rows).toEqual([
      { id: "t1", label: "Awal" },
      { id: "t2", label: "Konsumtif" },
      { id: "t3", label: null },
    ]);
  });

  it("breakdown per label berjumlah pas dengan total, transaksi multi-label tidak dihitung ganda", async () => {
    const rows = await db.getAllAsync<{ group_key: string | null; label: string; total: number }>(
      `SELECT ${PRIMARY} AS group_key, COALESCE(${PRIMARY}, 'Tanpa Label') AS label, SUM(transactions.amount) AS total
       FROM transactions GROUP BY group_key ORDER BY total DESC`
    );
    expect(rows).toEqual([
      { group_key: "Awal", label: "Awal", total: 100 },
      { group_key: "Konsumtif", label: "Konsumtif", total: 50 },
      { group_key: null, label: "Tanpa Label", total: 7 },
    ]);
    expect(rows.reduce((sum, row) => sum + row.total, 0)).toBe(157);
  });

  it("pemilihan transaksi drill-down memakai label yang sama dengan breakdown", async () => {
    const byKey = async (key: string | null) =>
      (
        await db.getAllAsync<{ id: string }>(
          `SELECT id FROM transactions WHERE ${key ? `${PRIMARY} = ?` : `${PRIMARY} IS NULL`} ORDER BY id`,
          key ? [key] : []
        )
      ).map((row) => row.id);

    expect(await byKey("Awal")).toEqual(["t1"]);
    // t1 juga berlabel Produktif, tapi tidak menyumbang angka Produktif, jadi tidak muncul di sana.
    expect(await byKey("Produktif")).toEqual([]);
    expect(await byKey(null)).toEqual(["t3"]);
  });
});
