import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createForexPurchase } from "./create-forex-purchase";
import { detachForexForDeletedTransaction } from "./detach-forex-for-deleted-transaction";
import { getForexAverageCostPerUnit, getForexRemainingUnit } from "./forex-holding-math";
import { InsufficientForexUnitsError, sellForex } from "./sell-forex";
import { balanceOf, createTestDb } from "./test/sqlite-test-db";

let db: ReturnType<typeof createTestDb>["db"];
let sqlite: DatabaseSync;

beforeEach(() => {
  ({ db, sqlite } = createTestDb());
  sqlite.exec(`
    INSERT INTO accounts (id, name, account_type, initial_balance) VALUES
      ('cash', 'BCA Rupiah', 'cash', 10000000),
      ('fx', 'USD BCA', 'forex', 0),
      ('debt', 'Piutang', 'debt', 0);
    INSERT INTO forex_accounts (account_id, country, currency, current_rate) VALUES ('fx', 'Amerika Serikat', 'USD', 16300);
  `);
});

async function buy(unit: number, rate: number, cashAccountId: string | null = "cash") {
  return createForexPurchase({
    db,
    forexAccountId: "fx",
    cashAccountId,
    unit,
    rate,
    date: "2026-11-01",
    note: "beli usd",
  });
}

const count = (table: string) =>
  (sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

describe("pembelian valas", () => {
  it("mencatat transfer kas -> valas senilai unit × kurs dan baris riwayat", async () => {
    await buy(100, 16000);

    expect(balanceOf(sqlite, "cash")).toBe(10_000_000 - 1_600_000);
    expect(balanceOf(sqlite, "fx")).toBe(1_600_000);
    expect(await getForexRemainingUnit(db, "fx")).toBe(100);
    expect(await getForexAverageCostPerUnit(db, "fx")).toBe(16000);
  });

  it("average cost berbobot dari beberapa pembelian", async () => {
    await buy(100, 16000);
    await buy(50, 16300);

    expect(await getForexAverageCostPerUnit(db, "fx")).toBeCloseTo((1_600_000 + 815_000) / 150, 6);
    expect(balanceOf(sqlite, "fx")).toBe(1_600_000 + 815_000);
  });

  it("mode direct tanpa kas sumber: income ke akun valas, kas tidak tersentuh", async () => {
    const { transactionId } = await buy(20, 15500, null);

    const tx = sqlite.prepare("SELECT type, account_id FROM transactions WHERE id = ?").get(transactionId) as {
      type: string;
      account_id: string;
    };
    expect(tx).toEqual({ type: "income", account_id: "fx" });
    expect(balanceOf(sqlite, "cash")).toBe(10_000_000);
    expect(balanceOf(sqlite, "fx")).toBe(310_000);
    expect(await getForexRemainingUnit(db, "fx")).toBe(20);
  });

  it("menolak akun yang bukan valas/kas dan angka tidak valid, tanpa menyisakan baris", async () => {
    await expect(
      createForexPurchase({ db, forexAccountId: "cash", cashAccountId: "cash", unit: 1, rate: 1, date: "2026-11-01", note: "x" })
    ).rejects.toThrow(/Valas/);
    await expect(
      createForexPurchase({ db, forexAccountId: "fx", cashAccountId: "debt", unit: 1, rate: 1, date: "2026-11-01", note: "x" })
    ).rejects.toThrow(/Kas/);
    await expect(buy(0, 16000)).rejects.toThrow();
    await expect(buy(10, 0)).rejects.toThrow();

    expect(count("transactions")).toBe(0);
    expect(count("forex_purchases")).toBe(0);
  });
});

describe("penjualan valas", () => {
  it("untung kurs: balance valas turun sebesar average cost, kas menerima nominal jual penuh", async () => {
    await buy(100, 16000);

    const result = await sellForex({
      db,
      forexAccountId: "fx",
      cashAccountId: "cash",
      unit: 30,
      rate: 16300,
      date: "2026-11-05",
      note: "jual usd",
    });

    expect(result.realizedPl).toBeCloseTo(9000, 6);
    expect(result.adjustmentTransactionId).not.toBeNull();
    expect(balanceOf(sqlite, "fx")).toBeCloseTo(16000 * 70, 6);
    // kas: 10jt − 1,6jt (beli) + 30 × 16.300 (hasil jual)
    expect(balanceOf(sqlite, "cash")).toBeCloseTo(10_000_000 - 1_600_000 + 30 * 16300, 6);
    expect(await getForexRemainingUnit(db, "fx")).toBe(70);

    const sale = sqlite.prepare("SELECT average_cost_per_unit, realized_pl FROM forex_sales").get() as {
      average_cost_per_unit: number;
      realized_pl: number;
    };
    expect(sale.average_cost_per_unit).toBe(16000);
    expect(sale.realized_pl).toBeCloseTo(9000, 6);
  });

  it("rugi kurs: transaksi penyesuaian bertipe expense di akun kas", async () => {
    await buy(100, 16000);

    const result = await sellForex({
      db,
      forexAccountId: "fx",
      cashAccountId: "cash",
      unit: 10,
      rate: 15800,
      date: "2026-11-05",
      note: "jual usd",
    });

    expect(result.realizedPl).toBeCloseTo(-2000, 6);
    const adjustment = sqlite
      .prepare("SELECT type, amount, account_id FROM transactions WHERE id = ?")
      .get(result.adjustmentTransactionId) as { type: string; amount: number; account_id: string };
    expect(adjustment.type).toBe("expense");
    expect(adjustment.amount).toBeCloseTo(2000, 6);
    expect(adjustment.account_id).toBe("cash");
    expect(balanceOf(sqlite, "cash")).toBeCloseTo(10_000_000 - 1_600_000 + 10 * 15800, 6);
  });

  it("jual di kurs sama dengan average cost tidak membuat transaksi penyesuaian", async () => {
    await buy(100, 16000);

    const result = await sellForex({
      db,
      forexAccountId: "fx",
      cashAccountId: "cash",
      unit: 10,
      rate: 16000,
      date: "2026-11-05",
      note: "jual usd",
    });

    expect(result.adjustmentTransactionId).toBeNull();
    expect(count("transactions")).toBe(2);
  });

  it("menjual seluruh unit membawa balance valas ke nol", async () => {
    await buy(100, 16000);
    await buy(50, 16300);

    await sellForex({ db, forexAccountId: "fx", cashAccountId: "cash", unit: 150, rate: 16400, date: "2026-11-05", note: "x" });

    expect(await getForexRemainingUnit(db, "fx")).toBe(0);
    expect(Math.abs(balanceOf(sqlite, "fx"))).toBeLessThan(0.001);
  });

  it("pembelian setelah penjualan: average cost mengikuti posisi tersisa, jual semua membawa balance ke nol", async () => {
    // Urutan sama dengan data dev 2026-11-07: beli, jual sebagian, lalu beli lagi di kurs berbeda.
    await buy(1, 18000);
    await sellForex({ db, forexAccountId: "fx", cashAccountId: "cash", unit: 1, rate: 17800, date: "2026-11-05", note: "x" });
    await buy(1.5, 18000);
    await buy(1, 16250.5);

    // Posisi tersisa 2,5 unit dengan modal 27.000 + 16.250,5 = 43.250,5.
    expect(balanceOf(sqlite, "fx")).toBeCloseTo(43250.5, 6);
    expect(await getForexAverageCostPerUnit(db, "fx")).toBeCloseTo(43250.5 / 2.5, 6);

    await sellForex({ db, forexAccountId: "fx", cashAccountId: "cash", unit: 2.5, rate: 17000, date: "2026-11-06", note: "x" });

    expect(await getForexRemainingUnit(db, "fx")).toBe(0);
    expect(Math.abs(balanceOf(sqlite, "fx"))).toBeLessThan(0.001);
  });

  it("menolak oversell tanpa menyisakan transaksi", async () => {
    await buy(100, 16000);
    const transactionsBefore = count("transactions");

    await expect(
      sellForex({ db, forexAccountId: "fx", cashAccountId: "cash", unit: 101, rate: 16000, date: "2026-11-05", note: "x" })
    ).rejects.toBeInstanceOf(InsufficientForexUnitsError);

    expect(count("transactions")).toBe(transactionsBefore);
    expect(count("forex_sales")).toBe(0);
  });

  it("menolak akun yang bukan valas/kas", async () => {
    await buy(100, 16000);
    await expect(
      sellForex({ db, forexAccountId: "cash", cashAccountId: "cash", unit: 1, rate: 16000, date: "2026-11-05", note: "x" })
    ).rejects.toThrow(/Valas/);
    await expect(
      sellForex({ db, forexAccountId: "fx", cashAccountId: "debt", unit: 1, rate: 16000, date: "2026-11-05", note: "x" })
    ).rejects.toThrow(/Kas/);
  });
});

describe("hapus transaksi valas", () => {
  it("menghapus transaksi pembelian ikut menghapus baris riwayat belinya", async () => {
    const { transactionId } = await buy(100, 16000);

    const info = await detachForexForDeletedTransaction(db, transactionId);
    sqlite.prepare("DELETE FROM transactions WHERE id = ?").run(transactionId);

    expect(info.deletedPurchaseIds).toHaveLength(1);
    expect(count("forex_purchases")).toBe(0);
    expect(await getForexRemainingUnit(db, "fx")).toBe(0);
  });

  it("menghapus leg transfer penjualan ikut menghapus baris jual dan transaksi selisih kurs", async () => {
    await buy(100, 16000);
    const sale = await sellForex({ db, forexAccountId: "fx", cashAccountId: "cash", unit: 30, rate: 16300, date: "2026-11-05", note: "x" });

    await detachForexForDeletedTransaction(db, sale.transactionId);
    sqlite.prepare("DELETE FROM transactions WHERE id = ?").run(sale.transactionId);

    expect(count("forex_sales")).toBe(0);
    expect(count("transactions")).toBe(1);
    expect(await getForexRemainingUnit(db, "fx")).toBe(100);
    expect(balanceOf(sqlite, "cash")).toBe(10_000_000 - 1_600_000);
  });

  it("menghapus transaksi selisih kurs ikut menghapus leg transfer dan baris jual", async () => {
    await buy(100, 16000);
    const sale = await sellForex({ db, forexAccountId: "fx", cashAccountId: "cash", unit: 30, rate: 16300, date: "2026-11-05", note: "x" });

    await detachForexForDeletedTransaction(db, sale.adjustmentTransactionId as string);
    sqlite.prepare("DELETE FROM transactions WHERE id = ?").run(sale.adjustmentTransactionId);

    expect(count("forex_sales")).toBe(0);
    expect(count("transactions")).toBe(1);
    expect(balanceOf(sqlite, "fx")).toBe(1_600_000);
  });
});
