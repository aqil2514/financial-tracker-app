import { beforeEach, describe, expect, it } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import { createSqliteTestDb } from "@/lib/database/testing/sqlite-test-db";
import { getInvestmentAccounts, getInvestmentDetail } from "./investment-queries";

let db: SQLiteDatabase;

beforeEach(async () => {
  db = await createSqliteTestDb();
  await db.execAsync(`
    INSERT INTO account_groups (id, name) VALUES ('g', 'Investasi');
    INSERT INTO accounts (id, name, account_type, group_id) VALUES
      ('cash', 'Kas', 'cash', NULL),
      ('inv1', 'Saham BBCA', 'investment', 'g'),
      ('inv2', 'Emas', 'investment', NULL),
      ('inv3', 'Tanpa Detail', 'investment', NULL);
    INSERT INTO investment_accounts (account_id, unit_label, current_market_value) VALUES
      ('inv1', 'lembar', 9000000), ('inv2', 'gram', 100);
    INSERT INTO transactions (id, note, type, amount, date, account_id, transfer_account_id) VALUES
      ('t1', 'Beli', 'transfer', 8000000, '2026-09-20', 'cash', 'inv1'),
      ('t2', 'Hibah', 'income', 900000, '2026-08-12', 'inv1', NULL);
    INSERT INTO investment_purchases (id, account_id, transaction_id, unit, price_per_unit, date, status) VALUES
      ('p1', 'inv1', 't1', 800, 10000, '2026-09-20', 'settled'),
      ('p2', 'inv1', 't2', 100, 9000, '2026-08-12', 'settled'),
      ('p3', 'inv1', NULL, 50, 8000, '2026-10-01', 'pending'),
      ('p4', 'inv1', 't1', NULL, NULL, '2026-10-02', 'pending');
    INSERT INTO investment_sales (id, account_id, unit, price_per_unit, date, status) VALUES
      ('s1', 'inv1', 10, 0, '2026-10-20', 'settled'),
      ('s2', 'inv1', 5, 9500, '2026-10-21', 'pending');
  `);
});

describe("getInvestmentAccounts", () => {
  it("hanya akun investasi, urut nama, modal dari transaksi (transfer masuk + income)", async () => {
    const accounts = await getInvestmentAccounts(db);

    expect(accounts.map((account) => account.id)).toEqual(["inv2", "inv1", "inv3"]);
    const bbca = accounts.find((account) => account.id === "inv1");
    expect(bbca).toMatchObject({
      groupName: "Investasi",
      unitLabel: "lembar",
      currentMarketValue: 9_000_000,
      balance: 8_900_000,
    });
  });

  it("akun investasi tanpa baris investment_accounts tetap tampil dengan nilai pasar 0", async () => {
    const orphan = (await getInvestmentAccounts(db)).find((account) => account.id === "inv3");
    expect(orphan).toMatchObject({ unitLabel: "", currentMarketValue: 0, balance: 0, marketValueUpdatedAt: null });
  });
});

describe("getInvestmentDetail", () => {
  it("akun bukan investasi atau tidak ada: null", async () => {
    expect(await getInvestmentDetail(db, "cash")).toBeNull();
    expect(await getInvestmentDetail(db, "tidak-ada")).toBeNull();
  });

  it("average cost hanya dari pembelian settled: (800×10000 + 100×9000) / 900", async () => {
    const detail = await getInvestmentDetail(db, "inv1");
    expect(detail?.averageCostPerUnit).toBeCloseTo((800 * 10_000 + 100 * 9_000) / 900);
  });

  it("belum ada pembelian settled: averageCostPerUnit null", async () => {
    expect((await getInvestmentDetail(db, "inv2"))?.averageCostPerUnit).toBeNull();
  });

  it("pembelian: direct dikenali dari transaksi income, nominal fallback unit × harga kalau transaksi hilang", async () => {
    const purchases = (await getInvestmentDetail(db, "inv1"))?.purchases ?? [];
    const byId = Object.fromEntries(purchases.map((purchase) => [purchase.id, purchase]));

    expect(byId.p2).toMatchObject({ isDirect: true, amount: 900_000, status: "settled" });
    expect(byId.p1).toMatchObject({ isDirect: false, amount: 8_000_000 });
    expect(byId.p3).toMatchObject({ isDirect: false, amount: 400_000, status: "pending" });
    expect(byId.p4).toMatchObject({ unit: null, pricePerUnit: null });
    expect(purchases.map((purchase) => purchase.id)).toEqual(["p4", "p3", "p1", "p2"]);
  });

  it("penjualan: write-off dikenali dari harga 0, pending belum punya P/L", async () => {
    const sales = (await getInvestmentDetail(db, "inv1"))?.sales ?? [];
    const byId = Object.fromEntries(sales.map((sale) => [sale.id, sale]));

    expect(byId.s1).toMatchObject({ isWriteOff: true, status: "settled" });
    expect(byId.s2).toMatchObject({ isWriteOff: false, status: "pending", realizedPl: null, averageCost: null });
  });
});
