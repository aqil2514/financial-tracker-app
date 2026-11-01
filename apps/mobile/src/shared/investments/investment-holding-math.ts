import type { SQLiteDatabase } from "expo-sqlite";

// Satu-satunya sumber rumus unit/average cost — dipakai tampilan detail, dan nanti logic jual (cek oversell,
// snapshot realized P/L). Jangan menduplikasi rumus ini di tempat lain.

// Average cost per unit = SUM(unit × harga) / SUM(unit) atas pembelian 'settled' saja (bukan FIFO).
// Baris tanpa unit/harga tidak ikut. Mengembalikan 0 kalau belum ada unit settled.
export async function getAverageCostPerUnit(db: SQLiteDatabase, accountId: string): Promise<number> {
  const row = await db.getFirstAsync<{ total_cost: number | null; total_unit: number | null }>(
    `SELECT SUM(unit * price_per_unit) AS total_cost, SUM(unit) AS total_unit
     FROM investment_purchases
     WHERE account_id = ? AND status = 'settled' AND unit IS NOT NULL AND price_per_unit IS NOT NULL`,
    [accountId]
  );
  const totalUnit = row?.total_unit ?? 0;
  if (!totalUnit) return 0;
  return (row?.total_cost ?? 0) / totalUnit;
}

// Sisa unit yang BISA DIJUAL (basis cek oversell), BUKAN total unit untuk Unrealized P/L:
//   SUM(unit, pembelian settled) − SUM(unit, penjualan pending + settled)
// Pembelian pending belum pasti nilainya jadi tidak ikut; penjualan pending sudah dikurangi (optimis).
export async function getRemainingUnit(db: SQLiteDatabase, accountId: string): Promise<number> {
  const [purchased, sold] = await Promise.all([
    db.getFirstAsync<{ total_unit: number | null }>(
      `SELECT SUM(unit) AS total_unit FROM investment_purchases WHERE account_id = ? AND status = 'settled'`,
      [accountId]
    ),
    db.getFirstAsync<{ total_unit: number | null }>(
      `SELECT SUM(unit) AS total_unit FROM investment_sales WHERE account_id = ? AND status IN ('pending', 'settled')`,
      [accountId]
    ),
  ]);
  return (purchased?.total_unit ?? 0) - (sold?.total_unit ?? 0);
}
