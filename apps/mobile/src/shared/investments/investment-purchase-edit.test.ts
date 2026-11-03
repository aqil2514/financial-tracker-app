import { beforeEach, describe, expect, it } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import { createSqliteTestDb } from "@/lib/database/testing/sqlite-test-db";
import { applyInvestmentTransactionEdit } from "./apply-investment-transaction-edit";
import { detachInvestmentPurchaseForDeletedTransaction } from "./detach-investment-purchase-for-deleted-transaction";
import { InvestmentPurchaseEditBlockedError } from "./investment-purchase-edit-guard";
import { getInvestmentPurchase } from "./investment-queries";
import { recordInvestmentPurchase } from "./record-investment-purchase";
import { updateInvestmentPurchase } from "./update-investment-purchase";

let db: SQLiteDatabase;

const DATE = "2026-11-01T10:00:00.000Z";

async function purchaseRows() {
  return db.getAllAsync<{ id: string; account_id: string; transaction_id: string | null; unit: number | null; date: string; status: string }>(
    "SELECT id, account_id, transaction_id, unit, date, status FROM investment_purchases ORDER BY created_at"
  );
}

// Pembelian settled 100 unit dari kas, lalu 30 unit sudah terjual (settled).
async function seedBoughtThenSold() {
  const transactionId = await recordInvestmentPurchase({
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
  await db.runAsync(
    `INSERT INTO investment_sales (id, account_id, unit, price_per_unit, date, status) VALUES ('s1', 'inv', 30, 12000, ?, 'settled')`,
    [DATE]
  );
  return transactionId;
}

beforeEach(async () => {
  db = await createSqliteTestDb();
  await db.execAsync(`
    INSERT INTO accounts (id, name, account_type, initial_balance) VALUES
      ('cash', 'Kas', 'cash', 5000000), ('cash2', 'Kas 2', 'cash', 0),
      ('inv', 'Saham', 'investment', 0), ('inv2', 'Emas', 'investment', 0);
    INSERT INTO investment_accounts (account_id, unit_label) VALUES ('inv', 'lembar'), ('inv2', 'gram');
  `);
});

describe("detachInvestmentPurchaseForDeletedTransaction", () => {
  it("transaksi tanpa pembelian: none", async () => {
    expect(await detachInvestmentPurchaseForDeletedTransaction(db, "tidak-ada")).toEqual({ role: "none" });
  });

  it("menghapus baris pembelian milik transaksi itu, bukan yang lain", async () => {
    const t1 = await recordInvestmentPurchase({ db, investmentAccountId: "inv", cashAccountId: "cash", amount: 1, unit: 1, pricePerUnit: 1, date: DATE, note: "a", status: "pending" });
    await recordInvestmentPurchase({ db, investmentAccountId: "inv", cashAccountId: "cash", amount: 1, unit: 1, pricePerUnit: 1, date: DATE, note: "b", status: "pending" });

    const result = await detachInvestmentPurchaseForDeletedTransaction(db, t1);

    expect(result.role).toBe("purchase");
    const remaining = await purchaseRows();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].transaction_id).not.toBe(t1);
  });

  it("unit pembelian settled sudah terjual: hapus DITOLAK dan baris tetap ada", async () => {
    const t1 = await seedBoughtThenSold();

    await expect(detachInvestmentPurchaseForDeletedTransaction(db, t1)).rejects.toBeInstanceOf(
      InvestmentPurchaseEditBlockedError
    );
    expect(await purchaseRows()).toHaveLength(1);
  });

  it("pesan penolakan hapus menyebut hapus, bukan ubah", async () => {
    const t1 = await seedBoughtThenSold();

    await expect(detachInvestmentPurchaseForDeletedTransaction(db, t1)).rejects.toThrow("tidak bisa dihapus");
  });

  it("pembelian pending tidak pernah diblok walau ada penjualan", async () => {
    await seedBoughtThenSold();
    const pending = await recordInvestmentPurchase({ db, investmentAccountId: "inv", cashAccountId: "cash", amount: 1, unit: 5, pricePerUnit: 1, date: DATE, note: "p", status: "pending" });

    expect((await detachInvestmentPurchaseForDeletedTransaction(db, pending)).role).toBe("purchase");
  });

  it("tanpa detach, menghapus transaksi meninggalkan baris yatim (alasan fungsi ini ada)", async () => {
    const t1 = await recordInvestmentPurchase({ db, investmentAccountId: "inv", cashAccountId: "cash", amount: 1, unit: 5, pricePerUnit: 1, date: DATE, note: "a", status: "settled" });

    await db.runAsync("DELETE FROM transactions WHERE id = ?", [t1]);

    const rows = await purchaseRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].transaction_id).toBeNull();
  });
});

describe("applyInvestmentTransactionEdit", () => {
  it("transfer kas -> investasi: tanggal disinkronkan, unit dan status tidak disentuh", async () => {
    const t1 = await seedBoughtThenSold();

    await applyInvestmentTransactionEdit({ db, transactionId: t1, type: "transfer", accountId: "cash2", transferAccountId: "inv", date: "2026-12-25" });

    const rows = await purchaseRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: "2026-12-25", unit: 100, status: "settled", account_id: "inv" });
  });

  it("memindah akun investasi tujuan: baris ikut pindah, selama sisa unit akun lama tetap valid", async () => {
    const t1 = await recordInvestmentPurchase({ db, investmentAccountId: "inv", cashAccountId: "cash", amount: 1, unit: 10, pricePerUnit: 1, date: DATE, note: "a", status: "settled" });

    await applyInvestmentTransactionEdit({ db, transactionId: t1, type: "transfer", accountId: "cash", transferAccountId: "inv2", date: DATE });

    expect((await purchaseRows())[0].account_id).toBe("inv2");
  });

  it("memindah akun ketika unitnya sudah terjual: DITOLAK dan tidak ada yang berubah", async () => {
    const t1 = await seedBoughtThenSold();

    await expect(
      applyInvestmentTransactionEdit({ db, transactionId: t1, type: "transfer", accountId: "cash", transferAccountId: "inv2", date: DATE })
    ).rejects.toBeInstanceOf(InvestmentPurchaseEditBlockedError);

    expect((await purchaseRows())[0].account_id).toBe("inv");
  });

  it("transaksi tidak lagi kas -> investasi: baris pembelian dihapus (kalau aman)", async () => {
    const t1 = await recordInvestmentPurchase({ db, investmentAccountId: "inv", cashAccountId: "cash", amount: 1, unit: 10, pricePerUnit: 1, date: DATE, note: "a", status: "settled" });

    await applyInvestmentTransactionEdit({ db, transactionId: t1, type: "transfer", accountId: "cash", transferAccountId: "cash2", date: DATE });

    expect(await purchaseRows()).toHaveLength(0);
  });

  it("pembelian langsung (income di akun investasi): tanggal disinkronkan, baris tetap", async () => {
    const t1 = await recordInvestmentPurchase({ db, investmentAccountId: "inv", cashAccountId: null, amount: 0, unit: 10, pricePerUnit: 5, date: DATE, note: "Hibah", status: "settled" });

    await applyInvestmentTransactionEdit({ db, transactionId: t1, type: "income", accountId: "inv", transferAccountId: null, date: "2027-01-02" });

    expect((await purchaseRows())[0]).toMatchObject({ date: "2027-01-02", unit: 10 });
  });

  it("transaksi biasa tanpa pembelian: transfer kas -> kas tidak membuat apa pun", async () => {
    await db.runAsync(
      `INSERT INTO transactions (id, note, type, amount, date, account_id, transfer_account_id) VALUES ('plain', 'x', 'transfer', 10, ?, 'cash', 'cash2')`,
      [DATE]
    );

    await applyInvestmentTransactionEdit({ db, transactionId: "plain", type: "transfer", accountId: "cash", transferAccountId: "cash2", date: DATE });

    expect(await purchaseRows()).toHaveLength(0);
  });
});

describe("updateInvestmentPurchase", () => {
  it("mengisi unit/harga final dan menandai settled (kasus utama: settlement dikonfirmasi)", async () => {
    await recordInvestmentPurchase({ db, investmentAccountId: "inv", cashAccountId: "cash", amount: 1_000_000, unit: null, pricePerUnit: null, date: DATE, note: "Reksadana", status: "pending" });
    const [row] = await purchaseRows();

    await updateInvestmentPurchase({ db, purchaseId: row.id, unit: 12.5, pricePerUnit: 80_000, status: "settled" });

    expect(await getInvestmentPurchase(db, row.id)).toMatchObject({ unit: 12.5, pricePerUnit: 80_000, status: "settled" });
  });

  it("tidak menyentuh transaksi", async () => {
    await recordInvestmentPurchase({ db, investmentAccountId: "inv", cashAccountId: "cash", amount: 1_000_000, unit: 1, pricePerUnit: 1, date: DATE, note: "x", status: "pending" });
    const [row] = await purchaseRows();
    const before = await db.getAllAsync("SELECT * FROM transactions");

    await updateInvestmentPurchase({ db, purchaseId: row.id, unit: 2, pricePerUnit: 3, status: "settled" });

    expect(await db.getAllAsync("SELECT * FROM transactions")).toEqual(before);
  });

  it("mengurangi unit di bawah yang sudah terjual: DITOLAK, data tetap", async () => {
    await seedBoughtThenSold();
    const [row] = await purchaseRows();

    await expect(
      updateInvestmentPurchase({ db, purchaseId: row.id, unit: 20, pricePerUnit: 10_000, status: "settled" })
    ).rejects.toBeInstanceOf(InvestmentPurchaseEditBlockedError);
    expect((await getInvestmentPurchase(db, row.id))?.unit).toBe(100);
  });

  it("mengurangi unit tapi masih cukup untuk yang terjual: lolos", async () => {
    await seedBoughtThenSold();
    const [row] = await purchaseRows();

    await updateInvestmentPurchase({ db, purchaseId: row.id, unit: 30, pricePerUnit: 10_000, status: "settled" });

    expect((await getInvestmentPurchase(db, row.id))?.unit).toBe(30);
  });

  it("mengembalikan settled ke pending ketika unitnya sudah terjual: DITOLAK", async () => {
    await seedBoughtThenSold();
    const [row] = await purchaseRows();

    await expect(
      updateInvestmentPurchase({ db, purchaseId: row.id, unit: 100, pricePerUnit: 10_000, status: "pending" })
    ).rejects.toBeInstanceOf(InvestmentPurchaseEditBlockedError);
  });

  it("baris yang tidak ada: error", async () => {
    await expect(updateInvestmentPurchase({ db, purchaseId: "hilang", unit: 1, pricePerUnit: 1, status: "pending" })).rejects.toThrow(
      "tidak ditemukan"
    );
  });
});
