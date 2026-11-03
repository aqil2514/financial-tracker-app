import type { SQLiteDatabase } from "expo-sqlite";
import { generateId } from "@/lib/database/generate-id";
import { getAverageCostPerUnit, getRemainingUnit } from "./investment-holding-math";

// Oversell WAJIB ditolak (beda dari unit/harga saat beli yang sengaja tidak divalidasi): menjual lebih dari
// yang dipegang tidak mungkin valid secara matematis.
export class InsufficientInvestmentUnitsError extends Error {
  constructor(remainingUnit: number, requestedUnit: number) {
    super(
      `Unit yang dijual (${requestedUnit}) melebihi sisa unit yang dimiliki (${remainingUnit}). ` +
        `Kurangi jumlah unit yang dijual, atau periksa kembali riwayat pembelian/penjualan akun ini.`
    );
    this.name = "InsufficientInvestmentUnitsError";
  }
}

const TRANSFER_NOTE = "Penjualan investasi";
const ADJUSTMENT_NOTE = "Realized P/L penjualan investasi";

export type RecordInvestmentSaleInput = {
  db: SQLiteDatabase;
  investmentAccountId: string;
  // Wajib untuk 'settled'; diabaikan untuk 'pending' (dana belum cair, kas belum boleh tersentuh).
  cashAccountId: string | null;
  unit: number;
  pricePerUnit: number;
  date: string;
  status: "pending" | "settled";
};

// Saldo akun investasi berkurang average_cost × unit (BUKAN nominal jual), jadi satu penjualan settled =
// leg transfer (average_cost × unit) + leg income/expense di akun kas sebesar |realized_pl| (NULL kalau 0).
async function insertSettledLegs(
  db: SQLiteDatabase,
  params: {
    investmentAccountId: string;
    cashAccountId: string;
    unit: number;
    pricePerUnit: number;
    date: string;
  }
) {
  const { investmentAccountId, cashAccountId, unit, pricePerUnit, date } = params;
  const averageCost = await getAverageCostPerUnit(db, investmentAccountId);
  const realizedPl = (pricePerUnit - averageCost) * unit;

  const transactionId = generateId();
  await db.runAsync(
    `INSERT INTO transactions (id, note, description, type, amount, date, category_id, account_id, transfer_account_id)
     VALUES (?, ?, NULL, 'transfer', ?, ?, NULL, ?, ?)`,
    [transactionId, TRANSFER_NOTE, averageCost * unit, date, investmentAccountId, cashAccountId]
  );

  let adjustmentTransactionId: string | null = null;
  if (realizedPl !== 0) {
    adjustmentTransactionId = generateId();
    await db.runAsync(
      `INSERT INTO transactions (id, note, description, type, amount, date, category_id, account_id, transfer_account_id)
       VALUES (?, ?, NULL, ?, ?, ?, NULL, ?, NULL)`,
      [
        adjustmentTransactionId,
        ADJUSTMENT_NOTE,
        realizedPl > 0 ? "income" : "expense",
        Math.abs(realizedPl),
        date,
        cashAccountId,
      ]
    );
  }

  return { transactionId, adjustmentTransactionId, averageCost, realizedPl };
}

// Semua penulisan dalam satu transaksi SQLite. Pending hanya menulis baris investment_sales: TIDAK ada
// transaksi, average_cost_per_unit dan realized_pl NULL sampai Settle (average cost bisa bergeser sebelum itu).
export async function recordInvestmentSale(input: RecordInvestmentSaleInput): Promise<string> {
  const { db, investmentAccountId, cashAccountId, unit, pricePerUnit, date, status } = input;
  if (status === "settled" && cashAccountId == null) {
    throw new Error("Akun kas tujuan wajib dipilih untuk penjualan yang langsung settled.");
  }

  const saleId = generateId();
  await db.withTransactionAsync(async () => {
    const remaining = await getRemainingUnit(db, investmentAccountId);
    if (unit > remaining) throw new InsufficientInvestmentUnitsError(remaining, unit);

    if (status === "pending") {
      await db.runAsync(
        `INSERT INTO investment_sales (id, account_id, unit, price_per_unit, date, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [saleId, investmentAccountId, unit, pricePerUnit, date]
      );
      return;
    }

    const legs = await insertSettledLegs(db, {
      investmentAccountId,
      cashAccountId: cashAccountId as string,
      unit,
      pricePerUnit,
      date,
    });
    await db.runAsync(
      `INSERT INTO investment_sales
        (id, account_id, transaction_id, adjustment_transaction_id, unit, price_per_unit,
         average_cost_per_unit, realized_pl, date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'settled')`,
      [
        saleId,
        investmentAccountId,
        legs.transactionId,
        legs.adjustmentTransactionId,
        unit,
        pricePerUnit,
        legs.averageCost,
        legs.realizedPl,
        date,
      ]
    );
  });

  return saleId;
}

type SaleRowForSettle = {
  account_id: string;
  unit: number;
  price_per_unit: number;
  date: string;
  status: "pending" | "settled";
};

// Baru di titik ini dana "cair": average cost dihitung dari kondisi SAAT INI lalu disimpan permanen.
// Tidak perlu cek oversell lagi — unit baris ini sudah dihitung terjual sejak pending.
export async function settleInvestmentSale(db: SQLiteDatabase, saleId: string, cashAccountId: string) {
  await db.withTransactionAsync(async () => {
    const sale = await db.getFirstAsync<SaleRowForSettle>(
      "SELECT account_id, unit, price_per_unit, date, status FROM investment_sales WHERE id = ?",
      [saleId]
    );
    if (!sale) throw new Error("Baris penjualan investasi tidak ditemukan.");
    if (sale.status === "settled") throw new Error("Penjualan ini sudah settled.");

    const legs = await insertSettledLegs(db, {
      investmentAccountId: sale.account_id,
      cashAccountId,
      unit: sale.unit,
      pricePerUnit: sale.price_per_unit,
      date: sale.date,
    });
    await db.runAsync(
      `UPDATE investment_sales
       SET transaction_id = ?, adjustment_transaction_id = ?, average_cost_per_unit = ?, realized_pl = ?, status = 'settled'
       WHERE id = ?`,
      [legs.transactionId, legs.adjustmentTransactionId, legs.averageCost, legs.realizedPl, saleId]
    );
  });
}

// Hanya untuk baris pending (tidak terikat transaksi apa pun). Yang settled hanya lewat hapus transaksinya.
export async function deletePendingInvestmentSale(db: SQLiteDatabase, saleId: string) {
  const sale = await db.getFirstAsync<{ status: "pending" | "settled" }>(
    "SELECT status FROM investment_sales WHERE id = ?",
    [saleId]
  );
  if (!sale) throw new Error("Baris penjualan investasi tidak ditemukan.");
  if (sale.status === "settled") {
    throw new Error("Penjualan yang sudah settled hanya bisa dihapus lewat hapus transaksinya.");
  }
  await db.runAsync("DELETE FROM investment_sales WHERE id = ?", [saleId]);
}

export type InvestmentSaleLegInfo = { role: "none" } | { role: "sale"; investmentSaleId: string };

// Salah satu dari dua leg penjualan (transfer utama atau penyesuaian P/L), bukan transaksi biasa.
export async function getTransactionInvestmentSale(
  db: SQLiteDatabase,
  transactionId: string
): Promise<InvestmentSaleLegInfo> {
  const row = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM investment_sales WHERE transaction_id = ? OR adjustment_transaction_id = ?",
    [transactionId, transactionId]
  );
  return row ? { role: "sale", investmentSaleId: row.id } : { role: "none" };
}

// Dipanggil SEBELUM baris transactions di-hard-delete. Kedua leg satu kesatuan: menghapus salah satunya
// menghapus baris penjualan DAN leg pasangannya (tanpa ini FK SET NULL meninggalkan penjualan yang unitnya
// masih terpotong tapi kas/saldonya tidak). Leg yang sedang dihapus caller dibiarkan untuk caller.
export async function detachInvestmentSaleForDeletedTransaction(
  db: SQLiteDatabase,
  transactionId: string
): Promise<InvestmentSaleLegInfo> {
  const row = await db.getFirstAsync<{
    id: string;
    transaction_id: string | null;
    adjustment_transaction_id: string | null;
  }>(
    `SELECT id, transaction_id, adjustment_transaction_id FROM investment_sales
     WHERE transaction_id = ? OR adjustment_transaction_id = ?`,
    [transactionId, transactionId]
  );
  if (!row) return { role: "none" };

  await db.runAsync("DELETE FROM investment_sales WHERE id = ?", [row.id]);
  for (const legId of [row.transaction_id, row.adjustment_transaction_id]) {
    if (legId != null && legId !== transactionId) {
      await db.runAsync("DELETE FROM transactions WHERE id = ?", [legId]);
    }
  }
  return { role: "sale", investmentSaleId: row.id };
}
