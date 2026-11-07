import { beforeEach, describe, expect, it } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import { createSqliteTestDb } from "@/lib/database/testing/sqlite-test-db";
import { getForexAccounts, getForexDetail } from "./forex-queries";
import {
  detachForexForDeletedTransaction,
  ForexPurchaseDeleteBlockedError,
  getForexAverageCostPerUnit,
  getForexRemainingUnit,
  getTransactionForex,
  InsufficientForexUnitsError,
  recordForexPurchase,
  sellForex,
  updateForexRate,
} from "./index";

const DATE = "2026-11-07 10:00:00";
let db: SQLiteDatabase;

async function balance(accountId: string): Promise<number> {
  const row = await db.getFirstAsync<{ balance: number }>(
    `SELECT initial_balance
       + COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'income'), 0)
       - COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'expense'), 0)
       - COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'transfer'), 0)
       + COALESCE((SELECT SUM(amount) FROM transactions WHERE transfer_account_id = a.id AND type = 'transfer'), 0) AS balance
     FROM accounts a WHERE a.id = ?`,
    [accountId]
  );
  return row?.balance ?? NaN;
}

async function count(table: string): Promise<number> {
  return (await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))?.n ?? NaN;
}

const buy = (unit: number, rate: number, cash: string | null = "cash") =>
  recordForexPurchase({ db, forexAccountId: "fx", cashAccountId: cash, unit, rate, date: DATE, note: "Beli USD" });
const sell = (unit: number, rate: number) =>
  sellForex({ db, forexAccountId: "fx", cashAccountId: "cash", unit, rate, date: DATE, note: "Jual USD" });

beforeEach(async () => {
  db = await createSqliteTestDb();
  await db.runAsync("INSERT INTO accounts (id, name, account_type, initial_balance) VALUES ('cash', 'BCA', 'cash', 10000000)");
  await db.runAsync("INSERT INTO accounts (id, name, account_type) VALUES ('fx', 'USD', 'forex')");
  await db.runAsync("INSERT INTO forex_accounts (account_id, country, currency) VALUES ('fx', 'Amerika Serikat', 'USD')");
});

describe("recordForexPurchase", () => {
  it("dari kas: transfer senilai unit × kurs, modal valas naik dan kas turun, riwayat tertulis", async () => {
    await buy(30, 18142);
    expect(await balance("fx")).toBe(30 * 18142);
    expect(await balance("cash")).toBe(10_000_000 - 30 * 18142);
    expect(await getForexRemainingUnit(db, "fx")).toBe(30);
    expect(await getForexAverageCostPerUnit(db, "fx")).toBe(18142);
  });

  it("tanpa kas: income ke akun valas, kas tidak tersentuh", async () => {
    await buy(10, 16000, null);
    expect(await balance("fx")).toBe(160_000);
    expect(await balance("cash")).toBe(10_000_000);
    const tx = await db.getFirstAsync<{ type: string }>("SELECT type FROM transactions");
    expect(tx?.type).toBe("income");
  });

  it("unit desimal diterima", async () => {
    await buy(0.5, 16000);
    expect(await getForexRemainingUnit(db, "fx")).toBe(0.5);
  });

  it("menolak input tidak valid dan akun bertipe salah tanpa menulis apa pun", async () => {
    await expect(buy(0, 16000)).rejects.toThrow();
    await expect(buy(1, 0)).rejects.toThrow();
    await expect(
      recordForexPurchase({ db, forexAccountId: "cash", cashAccountId: null, unit: 1, rate: 1, date: DATE, note: "x" })
    ).rejects.toThrow("bertipe Valas");
    await expect(buy(1, 1, "fx")).rejects.toThrow("bertipe Kas");
    expect(await count("transactions")).toBe(0);
    expect(await count("forex_purchases")).toBe(0);
  });

  it("rollback: kegagalan di tengah tidak meninggalkan transaksi tanpa riwayat", async () => {
    await db.runAsync("DROP TABLE forex_purchases");
    await expect(buy(1, 16000)).rejects.toThrow();
    expect(await count("transactions")).toBe(0);
  });
});

describe("average cost atas posisi tersisa", () => {
  it("beli 10 @ 100 dan 30 @ 200 = 175", async () => {
    await buy(10, 100);
    await buy(30, 200);
    expect(await getForexAverageCostPerUnit(db, "fx")).toBe(175);
  });

  it("jual sebagian lalu beli lagi di kurs berbeda: average cost × sisa unit = modal tersisa", async () => {
    await buy(100, 16000);
    await sell(60, 17000);
    await buy(20, 18000);
    const remaining = await getForexRemainingUnit(db, "fx");
    const average = await getForexAverageCostPerUnit(db, "fx");
    expect(remaining).toBe(60);
    expect(average * remaining).toBeCloseTo(await balance("fx"), 6);
  });

  it("belum ada pembelian atau sudah terjual semua: 0", async () => {
    expect(await getForexAverageCostPerUnit(db, "fx")).toBe(0);
    await buy(10, 16000);
    await sell(10, 17000);
    expect(await getForexAverageCostPerUnit(db, "fx")).toBe(0);
    expect(await balance("fx")).toBeCloseTo(0, 6);
  });
});

describe("sellForex", () => {
  it("untung: valas turun sebesar modal dilepas, kas naik sebesar nominal jual penuh, realized P/L tersimpan", async () => {
    await buy(100, 16000);
    const result = await sell(40, 17000);
    expect(result.realizedPl).toBe(40_000);
    expect(result.adjustmentTransactionId).not.toBeNull();
    expect(await balance("fx")).toBe(60 * 16000);
    expect(await balance("cash")).toBe(10_000_000 - 1_600_000 + 40 * 17000);
    const sale = await db.getFirstAsync<{ average_cost_per_unit: number; realized_pl: number }>("SELECT * FROM forex_sales");
    expect(sale?.average_cost_per_unit).toBe(16000);
    expect(sale?.realized_pl).toBe(40_000);
  });

  it("rugi: transaksi penyesuaian bertipe expense di kas", async () => {
    await buy(10, 16000);
    const result = await sell(10, 15000);
    expect(result.realizedPl).toBe(-10_000);
    const adjustment = await db.getFirstAsync<{ type: string; amount: number; account_id: string }>(
      "SELECT type, amount, account_id FROM transactions WHERE id = ?",
      [result.adjustmentTransactionId]
    );
    expect(adjustment).toEqual({ type: "expense", amount: 10_000, account_id: "cash" });
    expect(await balance("cash")).toBe(10_000_000 - 160_000 + 150_000);
  });

  it("impas: tanpa transaksi penyesuaian", async () => {
    await buy(10, 16000);
    const result = await sell(5, 16000);
    expect(result.adjustmentTransactionId).toBeNull();
    expect(await count("transactions")).toBe(2);
  });

  it("menolak oversell tanpa menulis apa pun", async () => {
    await buy(10, 16000);
    await expect(sell(11, 17000)).rejects.toThrow(InsufficientForexUnitsError);
    expect(await count("forex_sales")).toBe(0);
    expect(await count("transactions")).toBe(1);
  });
});

describe("updateForexRate", () => {
  it("mengubah kurs dan updated_at tanpa menyentuh transaksi", async () => {
    await db.runAsync("UPDATE forex_accounts SET updated_at = '2020-01-01 00:00:00' WHERE account_id = 'fx'");
    await updateForexRate(db, "fx", 16500);
    const row = await db.getFirstAsync<{ current_rate: number; updated_at: string }>("SELECT * FROM forex_accounts");
    expect(row?.current_rate).toBe(16500);
    expect(row?.updated_at).not.toBe("2020-01-01 00:00:00");
    expect(await count("transactions")).toBe(0);
    await expect(updateForexRate(db, "fx", 0)).rejects.toThrow();
  });
});

describe("detachForexForDeletedTransaction", () => {
  it("hapus pembelian yang unitnya belum terpakai: riwayat ikut terhapus", async () => {
    const { transactionId } = await buy(10, 16000);
    const info = await detachForexForDeletedTransaction(db, transactionId);
    expect(info.deletedPurchaseIds).toHaveLength(1);
    await db.runAsync("DELETE FROM transactions WHERE id = ?", [transactionId]);
    expect(await count("forex_purchases")).toBe(0);
  });

  it("hapus pembelian yang unitnya sudah terjual ditolak dan tidak mengubah apa pun", async () => {
    const { transactionId } = await buy(10, 16000);
    await sell(10, 17000);
    await expect(detachForexForDeletedTransaction(db, transactionId)).rejects.toThrow(ForexPurchaseDeleteBlockedError);
    expect(await count("forex_purchases")).toBe(1);
  });

  it("hapus salah satu leg penjualan menghapus penjualan dan transaksi pasangannya", async () => {
    await buy(10, 16000);
    const sale = await sell(5, 17000);
    const info = await detachForexForDeletedTransaction(db, sale.transactionId);
    expect(info.deletedSaleIds).toHaveLength(1);
    expect(info.deletedPairedTransactionIds).toEqual([sale.adjustmentTransactionId]);
    await db.runAsync("DELETE FROM transactions WHERE id = ?", [sale.transactionId]);
    expect(await count("forex_sales")).toBe(0);
    expect(await count("transactions")).toBe(1);
    expect(await getForexRemainingUnit(db, "fx")).toBe(10);
  });

  it("hapus leg penyesuaian juga menghapus leg transfer pasangannya", async () => {
    await buy(10, 16000);
    const sale = await sell(5, 17000);
    const info = await detachForexForDeletedTransaction(db, sale.adjustmentTransactionId as string);
    expect(info.deletedPairedTransactionIds).toEqual([sale.transactionId]);
  });

  it("transaksi biasa tanpa riwayat valas: tidak ada yang terhapus", async () => {
    await db.runAsync("INSERT INTO transactions (id, note, type, amount, date, account_id) VALUES ('t', 'x', 'expense', 1, ?, 'cash')", [DATE]);
    const info = await detachForexForDeletedTransaction(db, "t");
    expect(info).toEqual({ deletedPurchaseIds: [], deletedSaleIds: [], deletedPairedTransactionIds: [] });
  });
});

describe("getTransactionForex", () => {
  it("mengenali pembelian, kedua leg penjualan, dan transaksi biasa", async () => {
    const purchase = await buy(10, 16000);
    const sale = await sell(5, 17000);
    await db.runAsync("INSERT INTO transactions (id, note, type, amount, date, account_id) VALUES ('biasa', 'x', 'expense', 1, ?, 'cash')", [DATE]);
    expect(await getTransactionForex(db, purchase.transactionId)).toEqual({ role: "purchase" });
    expect(await getTransactionForex(db, sale.transactionId)).toEqual({ role: "sale" });
    expect(await getTransactionForex(db, sale.adjustmentTransactionId as string)).toEqual({ role: "sale" });
    expect(await getTransactionForex(db, "biasa")).toEqual({ role: "none" });
  });

  it("transaksi yang menyentuh akun valas tanpa riwayat tetap ditandai", async () => {
    await db.runAsync("INSERT INTO transactions (id, note, type, amount, date, account_id) VALUES ('liar', 'x', 'income', 1, ?, 'fx')", [DATE]);
    expect(await getTransactionForex(db, "liar")).toEqual({ role: "forex-account" });
  });
});

describe("forex-queries", () => {
  it("ringkasan akun: modal, unit tersisa, nilai terkini, average cost, dan Unrealized P/L konsisten", async () => {
    await buy(100, 16000);
    await sell(40, 17000);
    await updateForexRate(db, "fx", 16500);
    const [account] = await getForexAccounts(db);
    expect(account).toMatchObject({
      id: "fx",
      country: "Amerika Serikat",
      currency: "USD",
      balance: 60 * 16000,
      remainingUnit: 60,
      currentRate: 16500,
      currentValue: 60 * 16500,
      averageCost: 16000,
    });
  });

  it("detail: riwayat beli (langsung ditandai) dan jual dengan realized P/L total", async () => {
    await buy(10, 16000, null);
    await buy(10, 17000);
    await sell(5, 18000);
    const detail = await getForexDetail(db, "fx");
    expect(detail?.purchases).toHaveLength(2);
    expect(detail?.purchases.filter((p) => p.isDirect)).toHaveLength(1);
    expect(detail?.purchases.find((p) => p.isDirect)?.amount).toBe(160_000);
    expect(detail?.sales).toHaveLength(1);
    expect(detail?.totalRealizedPl).toBeCloseTo(detail?.sales[0].realizedPl ?? NaN, 6);
    expect(await getForexDetail(db, "cash")).toBeNull();
  });

  it("akun tanpa unit: nilai terkini dan average cost 0, bukan NaN", async () => {
    const [account] = await getForexAccounts(db);
    expect(account.currentValue).toBe(0);
    expect(account.averageCost).toBe(0);
  });
});
