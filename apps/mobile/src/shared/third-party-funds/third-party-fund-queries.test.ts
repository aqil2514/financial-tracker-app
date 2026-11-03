import { beforeEach, describe, expect, it } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import { createSqliteTestDb } from "@/lib/database/testing/sqlite-test-db";
import {
  getThirdPartyAccounts,
  getThirdPartyFundHistory,
  getThirdPartySummary,
  recordThirdPartyFund,
  recordThirdPartyTransfer,
} from ".";

let db: SQLiteDatabase;

beforeEach(async () => {
  db = await createSqliteTestDb();
  await db.execAsync(`
    INSERT INTO accounts (id, name, account_type, initial_balance) VALUES
      ('kas', 'Kas', 'cash', 1000000),
      ('tunai', 'Tunai', 'third_party', 0),
      ('jago', 'Jago', 'third_party', 0);
    INSERT INTO contacts (id, name) VALUES ('adel', 'Adel'), ('mama', 'Mama');
  `);
});

const base = { accountId: "tunai", contactId: "adel", note: null };

describe("third-party queries", () => {
  it("daftar akun hanya tipe third_party dengan saldo on-the-fly", async () => {
    await recordThirdPartyFund({ db, ...base, direction: "in", amount: 50_000, date: "2026-11-01T00:00:00.000Z" });

    const accounts = await getThirdPartyAccounts(db);

    expect(accounts.map((a) => [a.id, a.balance])).toEqual([
      ["jago", 0],
      ["tunai", 50_000],
    ]);
  });

  it("ringkasan per kontak × akun, pasangan lunas tidak tampil", async () => {
    const date = "2026-11-01T00:00:00.000Z";
    await recordThirdPartyFund({ db, ...base, direction: "in", amount: 50_000, date });
    await recordThirdPartyFund({ db, ...base, direction: "out", amount: 50_000, date });
    await recordThirdPartyFund({ db, ...base, contactId: "mama", direction: "in", amount: 20_000, date });
    await recordThirdPartyTransfer({
      db,
      sourceAccountId: "tunai",
      sourceContactId: "mama",
      destinationAccountId: "jago",
      destinationContactId: "mama",
      amount: 5_000,
      date,
      note: null,
    });

    const summary = await getThirdPartySummary(db);

    expect(summary.map((r) => [r.contactName, r.accountName, r.remaining])).toEqual([
      ["Mama", "Jago", 5_000],
      ["Mama", "Tunai", 15_000],
    ]);
  });

  it("riwayat terbaru dulu dan menandai baris transfer", async () => {
    await recordThirdPartyFund({ db, ...base, direction: "in", amount: 10_000, date: "2026-11-01T00:00:00.000Z" });
    await recordThirdPartyTransfer({
      db,
      sourceAccountId: "tunai",
      sourceContactId: "adel",
      destinationAccountId: "jago",
      destinationContactId: "adel",
      amount: 4_000,
      date: "2026-11-02T00:00:00.000Z",
      note: null,
    });

    const history = await getThirdPartyFundHistory(db);

    expect(history).toHaveLength(3);
    expect(history[2].isTransfer).toBe(false);
    expect(history[0].isTransfer).toBe(true);
    expect(history[1].isTransfer).toBe(true);
    expect(history[2].date).toBe("2026-11-01T00:00:00.000Z");
    expect(history[2].contactName).toBe("Adel");
  });
});
