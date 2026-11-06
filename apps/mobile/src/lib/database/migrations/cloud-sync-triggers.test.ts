import { beforeEach, describe, expect, it } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import { createSqliteTestDb } from "../testing/sqlite-test-db";

type QueueRow = { table_name: string; row_id: string; op: string };

async function queue(db: SQLiteDatabase) {
  return db.getAllAsync<QueueRow>("SELECT table_name, row_id, op FROM cloud_sync_queue ORDER BY id");
}

async function clearQueue(db: SQLiteDatabase) {
  await db.runAsync("DELETE FROM cloud_sync_queue");
}

async function seedAccount(db: SQLiteDatabase, id = "acc-1") {
  await db.runAsync("INSERT INTO accounts (id, name) VALUES (?, 'Kas')", [id]);
}

describe("trigger sync", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await createSqliteTestDb();
  });

  it("labels masuk antrean saat insert/update/delete", async () => {
    await clearQueue(db);
    await db.runAsync("INSERT INTO labels (id, name, scope) VALUES ('l1', 'X', 'account')");
    await db.runAsync("UPDATE labels SET name = 'Y' WHERE id = 'l1'");
    expect(await queue(db)).toEqual([{ table_name: "labels", row_id: "l1", op: "upsert" }]);
    await db.runAsync("DELETE FROM labels WHERE id = 'l1'");
    expect(await queue(db)).toEqual([{ table_name: "labels", row_id: "l1", op: "delete" }]);
  });

  it("mengisi updated_at saat INSERT tanpa nilai", async () => {
    await seedAccount(db);
    const row = await db.getFirstAsync<{ updated_at: string | null }>("SELECT updated_at FROM accounts WHERE id = 'acc-1'");
    expect(row?.updated_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("mempertahankan updated_at eksplisit saat INSERT dan UPDATE", async () => {
    await db.runAsync("INSERT INTO accounts (id, name, updated_at) VALUES ('a', 'Kas', '2020-01-01 00:00:00')");
    expect((await db.getFirstAsync<{ updated_at: string }>("SELECT updated_at FROM accounts WHERE id = 'a'"))?.updated_at).toBe(
      "2020-01-01 00:00:00"
    );
    await db.runAsync("UPDATE accounts SET name = 'B', updated_at = '2021-01-01 00:00:00' WHERE id = 'a'");
    expect((await db.getFirstAsync<{ updated_at: string }>("SELECT updated_at FROM accounts WHERE id = 'a'"))?.updated_at).toBe(
      "2021-01-01 00:00:00"
    );
  });

  it("menggeser updated_at saat UPDATE tanpa menyentuhnya", async () => {
    await db.runAsync("INSERT INTO accounts (id, name, updated_at) VALUES ('a', 'Kas', '2020-01-01 00:00:00')");
    await db.runAsync("UPDATE accounts SET name = 'B' WHERE id = 'a'");
    const row = await db.getFirstAsync<{ updated_at: string }>("SELECT updated_at FROM accounts WHERE id = 'a'");
    expect(row!.updated_at > "2020-01-01 00:00:00").toBe(true);
  });

  it("memasukkan INSERT/UPDATE/DELETE ke antrean dengan satu entry per baris", async () => {
    await seedAccount(db);
    await db.runAsync("UPDATE accounts SET name = 'B' WHERE id = 'acc-1'");
    expect(await queue(db)).toEqual([{ table_name: "accounts", row_id: "acc-1", op: "upsert" }]);

    await db.runAsync("DELETE FROM accounts WHERE id = 'acc-1'");
    expect(await queue(db)).toEqual([{ table_name: "accounts", row_id: "acc-1", op: "delete" }]);
  });

  it("tidak mengantre saat applying_pull = 1", async () => {
    await db.runAsync("UPDATE cloud_sync_state SET applying_pull = 1");
    await seedAccount(db);
    await db.runAsync("UPDATE accounts SET name = 'B' WHERE id = 'acc-1'");
    await db.runAsync("DELETE FROM accounts WHERE id = 'acc-1'");
    expect(await queue(db)).toEqual([]);
  });

  it("debt_accounts me-enqueue akunnya", async () => {
    await seedAccount(db);
    await clearQueue(db);
    await db.runAsync("INSERT INTO debt_accounts (account_id, direction) VALUES ('acc-1', 'payable')");
    expect(await queue(db)).toEqual([{ table_name: "accounts", row_id: "acc-1", op: "upsert" }]);
  });

  it("pivot kategori periode me-enqueue periodenya", async () => {
    await db.runAsync("INSERT INTO categories (id, name, type) VALUES ('c1', 'Makan', 'expense')");
    await db.runAsync("INSERT INTO category_periods (id, name, start_date, end_date) VALUES ('p1', 'P', '2026-01-01', '2026-01-31')");
    await clearQueue(db);
    await db.runAsync("INSERT INTO category_period_categories (id, period_id, category_id) VALUES ('x1', 'p1', 'c1')");
    expect(await queue(db)).toEqual([{ table_name: "category_periods", row_id: "p1", op: "upsert" }]);
  });

  it("menghapus periode dengan pivot tetap berakhir sebagai delete", async () => {
    await db.runAsync("INSERT INTO categories (id, name, type) VALUES ('c1', 'Makan', 'expense')");
    await db.runAsync("INSERT INTO category_periods (id, name, start_date, end_date) VALUES ('p1', 'P', '2026-01-01', '2026-01-31')");
    await db.runAsync("INSERT INTO category_period_categories (id, period_id, category_id) VALUES ('x1', 'p1', 'c1')");
    await clearQueue(db);
    await db.runAsync("DELETE FROM category_periods WHERE id = 'p1'");
    expect(await queue(db)).toEqual([{ table_name: "category_periods", row_id: "p1", op: "delete" }]);
  });

  it("cascade hapus akun memasukkan anak CASCADE sebagai delete", async () => {
    await seedAccount(db);
    await db.runAsync("INSERT INTO contacts (id, name) VALUES ('k1', 'Budi')");
    await db.runAsync(
      "INSERT INTO third_party_funds (id, account_id, contact_id, direction, amount, date) VALUES ('f1', 'acc-1', 'k1', 'in', 10, '2026-01-01T00:00')"
    );
    await clearQueue(db);
    await db.runAsync("DELETE FROM accounts WHERE id = 'acc-1'");
    const rows = await queue(db);
    expect(rows).toContainEqual({ table_name: "third_party_funds", row_id: "f1", op: "delete" });
    expect(rows).toContainEqual({ table_name: "accounts", row_id: "acc-1", op: "delete" });
  });

  it("SET NULL pada kontak memasukkan transaksi terkait sebagai upsert", async () => {
    await seedAccount(db);
    await db.runAsync("INSERT INTO contacts (id, name) VALUES ('k1', 'Budi')");
    await db.runAsync(
      "INSERT INTO transactions (id, note, type, amount, date, account_id, contact_id) VALUES ('t1', 'n', 'expense', 5, '2026-01-01T00:00', 'acc-1', 'k1')"
    );
    await clearQueue(db);
    await db.runAsync("DELETE FROM contacts WHERE id = 'k1'");
    const rows = await queue(db);
    expect(rows).toContainEqual({ table_name: "transactions", row_id: "t1", op: "upsert" });
    expect(rows).toContainEqual({ table_name: "contacts", row_id: "k1", op: "delete" });
    const tx = await db.getFirstAsync<{ contact_id: string | null }>("SELECT contact_id FROM transactions WHERE id = 't1'");
    expect(tx?.contact_id).toBeNull();
  });
});
