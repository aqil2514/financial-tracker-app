import type { SQLiteDatabase } from "expo-sqlite";

// Average cost per unit atas POSISI TERSISA = (modal beli − modal yang sudah dilepas lewat jual) / sisa unit.
// Modal yang dilepas tiap jual = unit × average_cost_per_unit snapshot-nya. Beda dari rumus investasi (rata-rata atas
// semua pembelian): rumus itu bergeser setelah jual lalu beli lagi di kurs berbeda. Port dari desktop (shared/forex).
export async function getForexAverageCostPerUnit(db: SQLiteDatabase, accountId: string): Promise<number> {
  const purchase = await db.getFirstAsync<{ cost: number | null; unit: number | null }>(
    "SELECT SUM(unit * rate) AS cost, SUM(unit) AS unit FROM forex_purchases WHERE account_id = ?",
    [accountId]
  );
  const sale = await db.getFirstAsync<{ cost: number | null; unit: number | null }>(
    "SELECT SUM(unit * average_cost_per_unit) AS cost, SUM(unit) AS unit FROM forex_sales WHERE account_id = ?",
    [accountId]
  );

  const remainingUnit = (purchase?.unit ?? 0) - (sale?.unit ?? 0);
  if (!(remainingUnit > 0)) return 0;
  return ((purchase?.cost ?? 0) - (sale?.cost ?? 0)) / remainingUnit;
}

// Sisa unit yang bisa dijual = SUM(unit beli) − SUM(unit jual). Tanpa filter status (valas tidak punya pending).
export async function getForexRemainingUnit(db: SQLiteDatabase, accountId: string): Promise<number> {
  const purchase = await db.getFirstAsync<{ total: number | null }>(
    "SELECT SUM(unit) AS total FROM forex_purchases WHERE account_id = ?",
    [accountId]
  );
  const sale = await db.getFirstAsync<{ total: number | null }>(
    "SELECT SUM(unit) AS total FROM forex_sales WHERE account_id = ?",
    [accountId]
  );
  return (purchase?.total ?? 0) - (sale?.total ?? 0);
}
