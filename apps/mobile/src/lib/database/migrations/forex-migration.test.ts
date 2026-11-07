import { describe, expect, it } from "vitest";
import { MIGRATIONS } from "./index";
import { createSqliteTestDb } from "../testing/sqlite-test-db";

const BEFORE_FOREX = 17;

describe("migrasi valas (0018, 0019)", () => {
  it("menjaga isi akun dan tabel anak, FK tetap aktif, dan trigger akun tetap hidup", async () => {
    const db = await createSqliteTestDb(BEFORE_FOREX);
    await db.runAsync("INSERT INTO accounts (id, name, account_type) VALUES ('a-cash', 'Kas', 'cash'), ('a-inv', 'Saham', 'investment')");
    await db.runAsync("INSERT INTO investment_accounts (account_id, unit_label) VALUES ('a-inv', 'lembar')");
    await db.runAsync("INSERT INTO transactions (id, note, type, amount, date, account_id) VALUES ('t1', 'x', 'income', 100, '2026-01-01', 'a-cash')");
    await db.runAsync("INSERT INTO investment_purchases (id, account_id, transaction_id, unit, price_per_unit, date, status) VALUES ('p1', 'a-inv', 't1', 1, 100, '2026-01-01', 'settled')");
    const before = await db.getAllAsync("SELECT * FROM accounts ORDER BY id");
    const queueBefore = await db.getAllAsync("SELECT table_name, row_id, op FROM cloud_sync_queue ORDER BY id");

    for (const migration of MIGRATIONS.slice(BEFORE_FOREX)) await migration.up(db);

    expect(await db.getAllAsync("SELECT * FROM accounts ORDER BY id")).toEqual(before);
    expect(await db.getAllAsync("SELECT table_name, row_id, op FROM cloud_sync_queue ORDER BY id")).toEqual(queueBefore);
    expect(await db.getAllAsync("PRAGMA foreign_key_check")).toEqual([]);
    expect((await db.getFirstAsync<{ foreign_keys: number }>("PRAGMA foreign_keys"))?.foreign_keys).toBe(1);

    await db.runAsync("INSERT INTO accounts (id, name, account_type) VALUES ('a-fx', 'USD', 'forex')");
    await expect(db.runAsync("INSERT INTO accounts (id, name, account_type) VALUES ('a-bad', 'X', 'lain')")).rejects.toThrow();

    await db.runAsync("DELETE FROM cloud_sync_queue");
    await db.runAsync("UPDATE accounts SET name = 'Kas 2' WHERE id = 'a-cash'");
    expect(await db.getAllAsync("SELECT table_name, row_id, op FROM cloud_sync_queue")).toEqual([
      { table_name: "accounts", row_id: "a-cash", op: "upsert" },
    ]);

    await db.runAsync("DELETE FROM accounts WHERE id = 'a-inv'");
    expect(await db.getAllAsync("SELECT id FROM investment_purchases")).toEqual([]);
    expect(await db.getAllAsync("SELECT account_id FROM investment_accounts")).toEqual([]);
    const row = await db.getFirstAsync<{ updated_at: string | null }>("SELECT updated_at FROM accounts WHERE id = 'a-fx'");
    expect(row?.updated_at).not.toBeNull();
  });

  it("tabel valas: cascade akun, antrean sync, dan updated_at otomatis", async () => {
    const db = await createSqliteTestDb();
    await db.runAsync("INSERT INTO accounts (id, name, account_type) VALUES ('fx', 'USD', 'forex')");
    await db.runAsync("INSERT INTO forex_accounts (account_id, country, currency) VALUES ('fx', 'AS', 'USD')");
    await db.runAsync("INSERT INTO forex_purchases (id, account_id, unit, rate, date) VALUES ('p1', 'fx', 10, 16000, '2026-01-01')");
    await db.runAsync("INSERT INTO forex_sales (id, account_id, unit, rate, average_cost_per_unit, realized_pl, date) VALUES ('s1', 'fx', 5, 17000, 16000, 5000, '2026-01-02')");

    const queue = await db.getAllAsync("SELECT table_name, row_id, op FROM cloud_sync_queue WHERE table_name LIKE 'forex_%' ORDER BY table_name");
    expect(queue).toEqual([
      { table_name: "forex_accounts", row_id: "fx", op: "upsert" },
      { table_name: "forex_purchases", row_id: "p1", op: "upsert" },
      { table_name: "forex_sales", row_id: "s1", op: "upsert" },
    ]);
    const purchase = await db.getFirstAsync<{ updated_at: string | null }>("SELECT updated_at FROM forex_purchases WHERE id = 'p1'");
    expect(purchase?.updated_at).not.toBeNull();

    await db.runAsync("DELETE FROM accounts WHERE id = 'fx'");
    expect(await db.getAllAsync("SELECT id FROM forex_purchases")).toEqual([]);
    expect(await db.getAllAsync("SELECT id FROM forex_sales")).toEqual([]);
    expect(await db.getAllAsync("SELECT account_id FROM forex_accounts")).toEqual([]);
  });
});
