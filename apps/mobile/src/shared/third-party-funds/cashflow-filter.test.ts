import { beforeEach, describe, expect, it } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import { createSqliteTestDb } from "@/lib/database/testing/sqlite-test-db";
import { EXCLUDE_THIRD_PARTY_TRANSACTIONS_SQL } from "./cashflow-filter";

let db: SQLiteDatabase;

beforeEach(async () => {
  db = await createSqliteTestDb();
  await db.execAsync(`
    INSERT INTO accounts (id, name, account_type, initial_balance) VALUES
      ('kas', 'Kas', 'cash', 0), ('tp', 'Titipan', 'third_party', 0);
    INSERT INTO transactions (id, note, type, amount, date, account_id) VALUES
      ('t1', '', 'income', 100, '2026-11-01T00:00:00.000Z', 'kas'),
      ('t2', '', 'income', 50, '2026-11-01T00:00:00.000Z', 'tp'),
      ('t3', '', 'expense', 30, '2026-11-01T00:00:00.000Z', 'tp'),
      ('t4', '', 'expense', 20, '2026-11-01T00:00:00.000Z', 'akun-hilang');
  `);
});

describe("EXCLUDE_THIRD_PARTY_TRANSACTIONS_SQL", () => {
  it("mengecualikan transaksi akun third_party, mempertahankan kas dan akun yang tidak ditemukan", async () => {
    const rows = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM transactions WHERE ${EXCLUDE_THIRD_PARTY_TRANSACTIONS_SQL} ORDER BY id`
    );
    expect(rows.map((r) => r.id)).toEqual(["t1", "t4"]);
  });

  it("bisa dipakai di dalam SUM(CASE ...) seperti di ringkasan transaksi", async () => {
    const row = await db.getFirstAsync<{ income: number; expense: number }>(
      `SELECT
         SUM(CASE WHEN type = 'income' AND ${EXCLUDE_THIRD_PARTY_TRANSACTIONS_SQL} THEN amount ELSE 0 END) AS income,
         SUM(CASE WHEN type = 'expense' AND ${EXCLUDE_THIRD_PARTY_TRANSACTIONS_SQL} THEN amount ELSE 0 END) AS expense
       FROM transactions`
    );
    expect(row).toEqual({ income: 100, expense: 20 });
  });
});
