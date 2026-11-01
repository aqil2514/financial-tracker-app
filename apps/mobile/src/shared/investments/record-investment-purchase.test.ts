import { describe, expect, it, vi } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import { recordInvestmentPurchase } from "./record-investment-purchase";

function createSpyDb(accountTypes: Record<string, string>) {
  const runAsync = vi.fn().mockResolvedValue(undefined);
  const getFirstAsync = vi.fn(async (_sql: string, params: string[]) => {
    const type = accountTypes[params[0]];
    return type ? { account_type: type } : null;
  });
  const withTransactionAsync = vi.fn(async (task: () => Promise<void>) => task());
  const db = { runAsync, getFirstAsync, withTransactionAsync } as unknown as SQLiteDatabase;
  return { db, runAsync, withTransactionAsync };
}

const BASE = {
  investmentAccountId: "inv-1",
  amount: 1_000_000,
  unit: 10,
  pricePerUnit: 100_000,
  date: "2026-11-01T10:00:00.000Z",
  note: "Beli",
};

describe("recordInvestmentPurchase", () => {
  it("transfer dari kas: satu transaksi transfer + satu baris pembelian, dalam satu transaksi SQLite", async () => {
    const { db, runAsync, withTransactionAsync } = createSpyDb({ "cash-1": "cash", "inv-1": "investment" });

    const transactionId = await recordInvestmentPurchase({ ...BASE, db, cashAccountId: "cash-1", status: "pending" });

    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(runAsync).toHaveBeenCalledTimes(2);
    const [txSql, txParams] = runAsync.mock.calls[0];
    expect(txSql).toContain("INSERT INTO transactions");
    expect(txSql).toContain("'transfer'");
    expect(txParams).toEqual([transactionId, "Beli", 1_000_000, BASE.date, "cash-1", "inv-1"]);
    const [purchaseSql, purchaseParams] = runAsync.mock.calls[1];
    expect(purchaseSql).toContain("INSERT INTO investment_purchases");
    expect(purchaseParams.slice(1)).toEqual(["inv-1", transactionId, 10, 100_000, BASE.date, "pending"]);
  });

  it("transfer: status settled diteruskan, unit/harga boleh null saat pending", async () => {
    const { db, runAsync } = createSpyDb({ "cash-1": "cash", "inv-1": "investment" });

    await recordInvestmentPurchase({ ...BASE, db, cashAccountId: "cash-1", unit: null, pricePerUnit: null, status: "pending" });

    const purchaseParams = runAsync.mock.calls[1][1];
    expect(purchaseParams.slice(3, 5)).toEqual([null, null]);
  });

  it("direct (tanpa kas): transaksi income di akun investasi + pembelian settled, tanpa transfer", async () => {
    const { db, runAsync } = createSpyDb({ "inv-1": "investment" });

    const transactionId = await recordInvestmentPurchase({ ...BASE, db, cashAccountId: null, amount: 0, status: "pending" });

    expect(runAsync).toHaveBeenCalledTimes(2);
    const [txSql, txParams] = runAsync.mock.calls[0];
    expect(txSql).toContain("'income'");
    expect(txSql).not.toContain("'transfer'");
    expect(txParams).toEqual([transactionId, "Beli", 0, BASE.date, "inv-1"]);
    const [purchaseSql, purchaseParams] = runAsync.mock.calls[1];
    expect(purchaseSql).toContain("'settled'");
    expect(purchaseParams.slice(1)).toEqual(["inv-1", transactionId, 10, 100_000, BASE.date]);
  });

  it("akun sumber/tujuan tidak ketemu: melempar error (transaksi SQLite akan rollback)", async () => {
    const { db } = createSpyDb({ "inv-1": "investment" });

    await expect(
      recordInvestmentPurchase({ ...BASE, db, cashAccountId: "hilang", status: "pending" })
    ).rejects.toThrow("tidak ditemukan");
  });
});
