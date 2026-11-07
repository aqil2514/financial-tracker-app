import { describe, expect, it } from "vitest";
import { createSqliteTestDb } from "@/lib/database/testing/sqlite-test-db";
import { enqueueAllRows } from "./enqueue-all";

describe("enqueueAllRows", () => {
  it("memasukkan semua baris yang ada, tidak menimpa entry delete, dan idempotent", async () => {
    const db = await createSqliteTestDb();
    await db.runAsync("INSERT INTO account_groups (id, name) VALUES ('g1', 'G')");
    await db.runAsync("INSERT INTO accounts (id, name, account_type) VALUES ('a1', 'Kas', 'investment')");
    await db.runAsync("INSERT INTO investment_accounts (account_id, unit_label) VALUES ('a1', 'lembar')");
    await db.runAsync("INSERT INTO accounts (id, name, account_type) VALUES ('fx', 'USD', 'forex')");
    await db.runAsync("INSERT INTO forex_accounts (account_id, country, currency) VALUES ('fx', 'AS', 'USD')");
    await db.runAsync("INSERT INTO contacts (id, name) VALUES ('k1', 'Budi')");
    await db.runAsync("DELETE FROM cloud_sync_queue");
    await db.runAsync("INSERT INTO cloud_sync_queue (table_name, row_id, op) VALUES ('contacts', 'k1', 'delete')");

    expect(await enqueueAllRows(db)).toBe(5);
    expect(
      await db.getAllAsync("SELECT table_name, row_id, op FROM cloud_sync_queue ORDER BY table_name, row_id")
    ).toEqual([
      { table_name: "account_groups", row_id: "g1", op: "upsert" },
      { table_name: "accounts", row_id: "a1", op: "upsert" },
      { table_name: "accounts", row_id: "fx", op: "upsert" },
      { table_name: "contacts", row_id: "k1", op: "delete" },
      { table_name: "forex_accounts", row_id: "fx", op: "upsert" },
      { table_name: "investment_accounts", row_id: "a1", op: "upsert" },
    ]);
    expect(await enqueueAllRows(db)).toBe(0);
  });
});
