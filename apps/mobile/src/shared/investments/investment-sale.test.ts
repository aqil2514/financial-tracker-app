import { beforeEach, describe, expect, it } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import { createSqliteTestDb } from "@/lib/database/testing/sqlite-test-db";
import { getInvestmentAccounts, getInvestmentDetail } from "./investment-queries";
import {
  deletePendingInvestmentSale,
  detachInvestmentSaleForDeletedTransaction,
  getTransactionInvestmentSale,
  InsufficientInvestmentUnitsError,
  recordInvestmentSale,
  recordInvestmentWriteOff,
  settleInvestmentSale,
} from "./investment-sale";
import { recordInvestmentPurchase } from "./record-investment-purchase";

let db: SQLiteDatabase;

const DATE = "2026-11-01T10:00:00.000Z";

async function balance(accountId: string) {
  const accounts = await getInvestmentAccounts(db);
  return accounts.find((a) => a.id === accountId)?.balance;
}

async function cashBalance() {
  const row = await db.getFirstAsync<{ balance: number }>(
    `SELECT initial_balance
       + COALESCE((SELECT SUM(CASE WHEN type='income' THEN amount WHEN type IN ('expense','transfer') THEN -amount ELSE 0 END)
                   FROM transactions WHERE account_id = 'cash'), 0)
       + COALESCE((SELECT SUM(amount) FROM transactions WHERE type='transfer' AND transfer_account_id = 'cash'), 0) AS balance
     FROM accounts WHERE id = 'cash'`
  );
  return row?.balance;
}

async function sales() {
  return db.getAllAsync<Record<string, unknown>>("SELECT * FROM investment_sales");
}

async function count(table: string) {
  return (await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))?.n;
}

// 100 unit settled @ 10.000 = modal 1.000.000, average cost 10.000.
async function seedHolding() {
  await recordInvestmentPurchase({
    db,
    investmentAccountId: "inv",
    cashAccountId: "cash",
    amount: 1_000_000,
    unit: 100,
    pricePerUnit: 10_000,
    date: DATE,
    note: "Beli",
    status: "settled",
  });
}

const SALE = { investmentAccountId: "inv", date: DATE };

beforeEach(async () => {
  db = await createSqliteTestDb();
  await db.execAsync(`
    INSERT INTO accounts (id, name, account_type, initial_balance) VALUES
      ('cash', 'Kas', 'cash', 5000000), ('inv', 'Saham', 'investment', 0);
    INSERT INTO investment_accounts (account_id, unit_label) VALUES ('inv', 'lembar');
  `);
});

describe("recordInvestmentSale — settled", () => {
  it("untung: saldo investasi turun average_cost × unit, kas menerima nominal jual penuh", async () => {
    await seedHolding();
    const cashBefore = (await cashBalance()) as number;

    await recordInvestmentSale({ ...SALE, db, cashAccountId: "cash", unit: 40, pricePerUnit: 12_000, status: "settled" });

    // 1.000.000 − (10.000 × 40)
    expect(await balance("inv")).toBe(600_000);
    // kas +480.000 (40 × 12.000) = leg transfer 400.000 + leg income 80.000
    expect((await cashBalance()) as number).toBe(cashBefore + 480_000);
    const [sale] = await sales();
    expect(sale).toMatchObject({ status: "settled", average_cost_per_unit: 10_000, realized_pl: 80_000 });
    expect(sale.transaction_id).not.toBeNull();
    expect(sale.adjustment_transaction_id).not.toBeNull();
    const adjustment = await db.getFirstAsync<{ type: string; amount: number; account_id: string }>(
      "SELECT type, amount, account_id FROM transactions WHERE id = ?",
      [sale.adjustment_transaction_id as string]
    );
    expect(adjustment).toEqual({ type: "income", amount: 80_000, account_id: "cash" });
  });

  it("rugi: leg penyesuaian berupa expense di akun kas", async () => {
    await seedHolding();
    const cashBefore = (await cashBalance()) as number;

    await recordInvestmentSale({ ...SALE, db, cashAccountId: "cash", unit: 10, pricePerUnit: 7_000, status: "settled" });

    expect((await cashBalance()) as number).toBe(cashBefore + 70_000);
    const [sale] = await sales();
    expect(sale.realized_pl).toBe(-30_000);
    const adjustment = await db.getFirstAsync<{ type: string; amount: number }>(
      "SELECT type, amount FROM transactions WHERE id = ?",
      [sale.adjustment_transaction_id as string]
    );
    expect(adjustment).toEqual({ type: "expense", amount: 30_000 });
  });

  it("harga jual sama dengan average cost: tanpa leg penyesuaian", async () => {
    await seedHolding();

    await recordInvestmentSale({ ...SALE, db, cashAccountId: "cash", unit: 10, pricePerUnit: 10_000, status: "settled" });

    const [sale] = await sales();
    expect(sale.adjustment_transaction_id).toBeNull();
    expect(sale.realized_pl).toBe(0);
    expect(await count("transactions")).toBe(2);
  });

  it("tanpa akun kas: ditolak", async () => {
    await seedHolding();
    await expect(
      recordInvestmentSale({ ...SALE, db, cashAccountId: null, unit: 1, pricePerUnit: 1, status: "settled" })
    ).rejects.toThrow("Akun kas");
  });
});

describe("recordInvestmentSale — pending", () => {
  it("hanya menulis baris penjualan: tidak ada transaksi, P/L dan average cost NULL, saldo tak berubah", async () => {
    await seedHolding();
    const txBefore = await count("transactions");

    await recordInvestmentSale({ ...SALE, db, cashAccountId: "cash", unit: 40, pricePerUnit: 12_000, status: "pending" });

    expect(await count("transactions")).toBe(txBefore);
    expect(await balance("inv")).toBe(1_000_000);
    const [sale] = await sales();
    expect(sale).toMatchObject({
      status: "pending",
      transaction_id: null,
      adjustment_transaction_id: null,
      average_cost_per_unit: null,
      realized_pl: null,
    });
  });

  it("unit langsung terpotong dari sisa (optimis): penjualan kedua yang melebihi sisa ditolak", async () => {
    await seedHolding();
    await recordInvestmentSale({ ...SALE, db, cashAccountId: null, unit: 80, pricePerUnit: 1, status: "pending" });

    await expect(
      recordInvestmentSale({ ...SALE, db, cashAccountId: null, unit: 21, pricePerUnit: 1, status: "pending" })
    ).rejects.toBeInstanceOf(InsufficientInvestmentUnitsError);
    expect(await sales()).toHaveLength(1);
  });
});

describe("oversell", () => {
  it("pembelian pending tidak ikut sisa unit yang bisa dijual", async () => {
    await recordInvestmentPurchase({ db, investmentAccountId: "inv", cashAccountId: "cash", amount: 1, unit: 10, pricePerUnit: 1, date: DATE, note: "p", status: "pending" });

    await expect(
      recordInvestmentSale({ ...SALE, db, cashAccountId: "cash", unit: 1, pricePerUnit: 1, status: "settled" })
    ).rejects.toBeInstanceOf(InsufficientInvestmentUnitsError);
    expect(await count("transactions")).toBe(1);
  });

  it("menjual persis seluruh sisa unit: lolos", async () => {
    await seedHolding();
    await recordInvestmentSale({ ...SALE, db, cashAccountId: "cash", unit: 100, pricePerUnit: 10_000, status: "settled" });
    expect(await balance("inv")).toBe(0);
  });
});

describe("settleInvestmentSale", () => {
  it("average cost dihitung SAAT settle, bukan saat baris dibuat", async () => {
    await seedHolding();
    await recordInvestmentSale({ ...SALE, db, cashAccountId: null, unit: 40, pricePerUnit: 12_000, status: "pending" });
    // pembelian baru settled di antara pending dan settle: average cost bergeser jadi 15.000 (100@10k + 100@20k)
    await recordInvestmentPurchase({ db, investmentAccountId: "inv", cashAccountId: "cash", amount: 2_000_000, unit: 100, pricePerUnit: 20_000, date: DATE, note: "Beli lagi", status: "settled" });
    const [pending] = await sales();

    await settleInvestmentSale(db, pending.id as string, "cash");

    const [sale] = await sales();
    expect(sale).toMatchObject({ status: "settled", average_cost_per_unit: 15_000, realized_pl: -120_000 });
    expect(sale.transaction_id).not.toBeNull();
    // modal: 1.000.000 + 2.000.000 − (15.000 × 40)
    expect(await balance("inv")).toBe(2_400_000);
  });

  it("menolak penjualan yang sudah settled", async () => {
    await seedHolding();
    const saleId = await recordInvestmentSale({ ...SALE, db, cashAccountId: "cash", unit: 1, pricePerUnit: 1, status: "settled" });
    await expect(settleInvestmentSale(db, saleId, "cash")).rejects.toThrow("sudah settled");
  });

  it("baris tidak ada: error, dan tidak ada transaksi yatim", async () => {
    await expect(settleInvestmentSale(db, "hilang", "cash")).rejects.toThrow("tidak ditemukan");
    expect(await count("transactions")).toBe(0);
  });

  it("muncul di detail sebagai settled dengan P/L terealisasi", async () => {
    await seedHolding();
    const saleId = await recordInvestmentSale({ ...SALE, db, cashAccountId: null, unit: 10, pricePerUnit: 11_000, status: "pending" });
    await settleInvestmentSale(db, saleId, "cash");

    const detail = await getInvestmentDetail(db, "inv");
    expect(detail?.sales[0]).toMatchObject({ status: "settled", realizedPl: 10_000, averageCost: 10_000 });
  });
});

describe("deletePendingInvestmentSale", () => {
  it("menghapus baris pending", async () => {
    await seedHolding();
    const saleId = await recordInvestmentSale({ ...SALE, db, cashAccountId: null, unit: 10, pricePerUnit: 1, status: "pending" });
    await deletePendingInvestmentSale(db, saleId);
    expect(await sales()).toHaveLength(0);
  });

  it("menolak yang sudah settled", async () => {
    await seedHolding();
    const saleId = await recordInvestmentSale({ ...SALE, db, cashAccountId: "cash", unit: 10, pricePerUnit: 1, status: "settled" });
    await expect(deletePendingInvestmentSale(db, saleId)).rejects.toThrow("settled");
    expect(await sales()).toHaveLength(1);
  });
});

describe("hapus transaksi penjualan", () => {
  it("menghapus leg transfer: baris penjualan dan leg penyesuaian ikut hilang, saldo kembali", async () => {
    await seedHolding();
    const cashBefore = (await cashBalance()) as number;
    await recordInvestmentSale({ ...SALE, db, cashAccountId: "cash", unit: 40, pricePerUnit: 12_000, status: "settled" });
    const [sale] = await sales();

    await db.withTransactionAsync(async () => {
      await detachInvestmentSaleForDeletedTransaction(db, sale.transaction_id as string);
      await db.runAsync("DELETE FROM transactions WHERE id = ?", [sale.transaction_id as string]);
    });

    expect(await sales()).toHaveLength(0);
    expect(await count("transactions")).toBe(1);
    expect(await balance("inv")).toBe(1_000_000);
    expect((await cashBalance()) as number).toBe(cashBefore);
  });

  it("menghapus leg penyesuaian: hasilnya sama (kedua leg satu kesatuan)", async () => {
    await seedHolding();
    await recordInvestmentSale({ ...SALE, db, cashAccountId: "cash", unit: 40, pricePerUnit: 12_000, status: "settled" });
    const [sale] = await sales();

    await detachInvestmentSaleForDeletedTransaction(db, sale.adjustment_transaction_id as string);
    await db.runAsync("DELETE FROM transactions WHERE id = ?", [sale.adjustment_transaction_id as string]);

    expect(await sales()).toHaveLength(0);
    expect(await count("transactions")).toBe(1);
  });

  it("transaksi biasa: none, dan getTransactionInvestmentSale mengenali kedua leg", async () => {
    await seedHolding();
    await recordInvestmentSale({ ...SALE, db, cashAccountId: "cash", unit: 40, pricePerUnit: 12_000, status: "settled" });
    const [sale] = await sales();

    expect(await detachInvestmentSaleForDeletedTransaction(db, "tidak-ada")).toEqual({ role: "none" });
    expect((await getTransactionInvestmentSale(db, sale.transaction_id as string)).role).toBe("sale");
    expect((await getTransactionInvestmentSale(db, sale.adjustment_transaction_id as string)).role).toBe("sale");
    expect((await getTransactionInvestmentSale(db, "tidak-ada")).role).toBe("none");
  });
});

describe("recordInvestmentWriteOff", () => {
  it("saldo investasi turun average_cost × unit lewat expense langsung, tanpa menyentuh kas", async () => {
    await seedHolding();
    const cashBefore = (await cashBalance()) as number;

    await recordInvestmentWriteOff({ db, investmentAccountId: "inv", unit: 30, date: DATE, note: "Delisting" });

    expect(await balance("inv")).toBe(700_000);
    expect((await cashBalance()) as number).toBe(cashBefore);
    const [sale] = await sales();
    expect(sale).toMatchObject({
      status: "settled",
      price_per_unit: 0,
      average_cost_per_unit: 10_000,
      realized_pl: -300_000,
      adjustment_transaction_id: null,
    });
    const tx = await db.getFirstAsync<{ type: string; amount: number; account_id: string; transfer_account_id: string | null }>(
      "SELECT type, amount, account_id, transfer_account_id FROM transactions WHERE id = ?",
      [sale.transaction_id as string]
    );
    expect(tx).toEqual({ type: "expense", amount: 300_000, account_id: "inv", transfer_account_id: null });
  });

  it("muncul di detail sebagai write-off dan memotong sisa unit", async () => {
    await seedHolding();
    await recordInvestmentWriteOff({ db, investmentAccountId: "inv", unit: 30, date: DATE, note: "x" });

    const detail = await getInvestmentDetail(db, "inv");
    expect(detail?.sales[0]).toMatchObject({ isWriteOff: true, realizedPl: -300_000 });
    await expect(
      recordInvestmentWriteOff({ db, investmentAccountId: "inv", unit: 71, date: DATE, note: "x" })
    ).rejects.toBeInstanceOf(InsufficientInvestmentUnitsError);
  });

  it("jual biasa dengan P/L nol tidak terbaca sebagai write-off", async () => {
    await seedHolding();
    await recordInvestmentSale({ ...SALE, db, cashAccountId: "cash", unit: 10, pricePerUnit: 10_000, status: "settled" });
    expect((await getInvestmentDetail(db, "inv"))?.sales[0].isWriteOff).toBe(false);
  });

  it("hapus transaksinya menghapus baris write-off dan mengembalikan saldo", async () => {
    await seedHolding();
    await recordInvestmentWriteOff({ db, investmentAccountId: "inv", unit: 30, date: DATE, note: "x" });
    const [sale] = await sales();

    await db.withTransactionAsync(async () => {
      await detachInvestmentSaleForDeletedTransaction(db, sale.transaction_id as string);
      await db.runAsync("DELETE FROM transactions WHERE id = ?", [sale.transaction_id as string]);
    });

    expect(await sales()).toHaveLength(0);
    expect(await balance("inv")).toBe(1_000_000);
  });

  it("oversell: ditolak tanpa transaksi yatim", async () => {
    await seedHolding();
    const txBefore = await count("transactions");
    await expect(
      recordInvestmentWriteOff({ db, investmentAccountId: "inv", unit: 101, date: DATE, note: "x" })
    ).rejects.toBeInstanceOf(InsufficientInvestmentUnitsError);
    expect(await count("transactions")).toBe(txBefore);
  });
});
