import { beforeEach, describe, expect, it } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import { createSqliteTestDb } from "@/lib/database/testing/sqlite-test-db";
import { getAverageCostPerUnit, getRemainingUnit } from "./investment-holding-math";

let db: SQLiteDatabase;

async function addPurchase(id: string, unit: number | null, price: number | null, status: "pending" | "settled") {
  await db.runAsync(
    `INSERT INTO investment_purchases (id, account_id, unit, price_per_unit, date, status) VALUES (?, 'inv', ?, ?, '2026-11-01', ?)`,
    [id, unit, price, status]
  );
}

async function addSale(id: string, unit: number, status: "pending" | "settled") {
  await db.runAsync(
    `INSERT INTO investment_sales (id, account_id, unit, price_per_unit, date, status) VALUES (?, 'inv', ?, 1000, '2026-11-02', ?)`,
    [id, unit, status]
  );
}

beforeEach(async () => {
  db = await createSqliteTestDb();
  await db.runAsync(`INSERT INTO accounts (id, name, account_type) VALUES ('inv', 'Saham', 'investment')`);
});

describe("getAverageCostPerUnit", () => {
  it("belum ada pembelian: 0", async () => {
    expect(await getAverageCostPerUnit(db, "inv")).toBe(0);
  });

  it("rata-rata tertimbang unit: 10 @ 100 dan 30 @ 200 = 175", async () => {
    await addPurchase("a", 10, 100, "settled");
    await addPurchase("b", 30, 200, "settled");
    expect(await getAverageCostPerUnit(db, "inv")).toBe(175);
  });

  it("pembelian pending tidak ikut", async () => {
    await addPurchase("a", 10, 100, "settled");
    await addPurchase("b", 90, 900, "pending");
    expect(await getAverageCostPerUnit(db, "inv")).toBe(100);
  });

  it("baris settled tanpa unit atau harga tidak merusak rata-rata", async () => {
    await addPurchase("a", 10, 100, "settled");
    await addPurchase("b", 5, null, "settled");
    await addPurchase("c", null, 500, "settled");
    expect(await getAverageCostPerUnit(db, "inv")).toBe(100);
  });

  it("hanya menghitung akun yang diminta", async () => {
    await db.runAsync(`INSERT INTO accounts (id, name, account_type) VALUES ('other', 'Emas', 'investment')`);
    await db.runAsync(
      `INSERT INTO investment_purchases (id, account_id, unit, price_per_unit, date, status) VALUES ('x', 'other', 1, 999, '2026-11-01', 'settled')`
    );
    await addPurchase("a", 10, 100, "settled");
    expect(await getAverageCostPerUnit(db, "inv")).toBe(100);
  });

  it("data campuran dari form: unit desimal dan harga hasil bagi total", async () => {
    await addPurchase("a", 1.25, 800_000, "settled");
    expect(await getAverageCostPerUnit(db, "inv")).toBeCloseTo(800_000);
  });
});

describe("getRemainingUnit", () => {
  it("tanpa data: 0", async () => {
    expect(await getRemainingUnit(db, "inv")).toBe(0);
  });

  it("hanya pembelian settled yang dihitung, pending tidak", async () => {
    await addPurchase("a", 10, 100, "settled");
    await addPurchase("b", 5, 100, "pending");
    expect(await getRemainingUnit(db, "inv")).toBe(10);
  });

  it("penjualan pending dan settled sama-sama mengurangi", async () => {
    await addPurchase("a", 100, 100, "settled");
    await addSale("s1", 30, "settled");
    await addSale("s2", 20, "pending");
    expect(await getRemainingUnit(db, "inv")).toBe(50);
  });

  it("bisa negatif kalau data tidak konsisten (guard oversell ada di logic jual, bukan di sini)", async () => {
    await addPurchase("a", 10, 100, "settled");
    await addSale("s1", 15, "settled");
    expect(await getRemainingUnit(db, "inv")).toBe(-5);
  });
});
