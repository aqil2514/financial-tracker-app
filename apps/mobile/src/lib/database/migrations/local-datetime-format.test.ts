import { describe, expect, it } from "vitest";
import { createSqliteTestDb } from "../testing/sqlite-test-db";
import { up } from "./0013_local_datetime_format";

const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

describe("0013 format tanggal lokal", () => {
  it("mengonversi ISO UTC dan datetime('now') lama, membiarkan format baru", async () => {
    const db = await createSqliteTestDb();
    await db.runAsync("INSERT INTO accounts (id, name) VALUES ('a', 'Kas')");
    const insert = "INSERT INTO transactions (id, note, type, amount, date, account_id) VALUES (?, 'n', 'expense', 1, ?, 'a')";
    await db.runAsync(insert, ["iso", "2026-11-04T05:30:00.000Z"]);
    await db.runAsync(insert, ["sql", "2026-11-04 05:30:00"]);
    await db.runAsync(insert, ["baru", "2026-11-04T05:30"]);
    await db.runAsync("INSERT INTO category_periods (id, name, start_date, end_date) VALUES ('p', 'P', '2026-11-01T00:00:00.000Z', '2026-11-30T00:00:00.000Z')");

    await up(db);

    const rows = await db.getAllAsync<{ id: string; date: string }>("SELECT id, date FROM transactions");
    for (const row of rows) expect(row.date).toMatch(LOCAL_DATETIME);
    expect(rows.find((row) => row.id === "baru")?.date).toBe("2026-11-04T05:30");

    const period = await db.getFirstAsync<{ start_date: string; end_date: string }>("SELECT start_date, end_date FROM category_periods");
    expect(period?.start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(period?.end_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
