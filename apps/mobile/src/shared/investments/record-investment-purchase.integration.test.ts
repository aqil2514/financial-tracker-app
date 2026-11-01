import { beforeEach, describe, expect, it } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import { createSqliteTestDb } from "@/lib/database/testing/sqlite-test-db";
import { getInvestmentDetail } from "./investment-queries";
import { recordInvestmentPurchase } from "./record-investment-purchase";

let db: SQLiteDatabase;

const BASE = {
  investmentAccountId: "inv",
  unit: 10,
  pricePerUnit: 100_000,
  date: "2026-11-01T10:00:00.000Z",
  note: "Beli",
};

async function count(table: string) {
  return (await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))?.n;
}

beforeEach(async () => {
  db = await createSqliteTestDb();
  await db.execAsync(`
    INSERT INTO accounts (id, name, account_type, initial_balance) VALUES ('cash', 'Kas', 'cash', 5000000), ('inv', 'Saham', 'investment', 0);
    INSERT INTO investment_accounts (account_id, unit_label) VALUES ('inv', 'lembar');
  `);
});

describe("recordInvestmentPurchase (SQLite asli)", () => {
  it("transfer dari kas: modal investasi naik, pembelian tercatat pending", async () => {
    await recordInvestmentPurchase({ ...BASE, db, cashAccountId: "cash", amount: 1_000_000, status: "pending" });

    const detail = await getInvestmentDetail(db, "inv");
    expect(detail?.account.balance).toBe(1_000_000);
    expect(detail?.purchases).toHaveLength(1);
    expect(detail?.purchases[0]).toMatchObject({ status: "pending", isDirect: false, amount: 1_000_000 });
    // pending belum ikut average cost
    expect(detail?.averageCostPerUnit).toBeNull();
  });

  it("direct: nominal 0 tidak menambah modal, pembelian settled dan ikut average cost", async () => {
    await recordInvestmentPurchase({ ...BASE, db, cashAccountId: null, amount: 0, status: "pending" });

    const detail = await getInvestmentDetail(db, "inv");
    expect(detail?.account.balance).toBe(0);
    expect(detail?.purchases[0]).toMatchObject({ status: "settled", isDirect: true });
    expect(detail?.averageCostPerUnit).toBe(100_000);
  });

  it("gagal di tengah jalan: transaksi di-rollback, tidak ada transaksi yatim", async () => {
    await expect(
      recordInvestmentPurchase({
        ...BASE,
        db,
        investmentAccountId: "tidak-ada",
        cashAccountId: null,
        amount: 0,
        status: "settled",
      })
    ).rejects.toThrow();

    expect(await count("transactions")).toBe(0);
    expect(await count("investment_purchases")).toBe(0);
  });
});
