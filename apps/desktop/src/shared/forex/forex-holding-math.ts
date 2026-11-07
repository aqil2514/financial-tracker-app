import type { getDb } from "@/lib/db";

type Db = Awaited<ReturnType<typeof getDb>>;

// Average cost per unit atas POSISI TERSISA = (modal beli − modal yang sudah dilepas lewat jual) / sisa unit.
// Modal yang dilepas tiap jual = unit × average_cost_per_unit snapshot-nya. Rata-rata atas semua pembelian
// tanpa mengurangi yang sudah terjual salah: setelah jual lalu beli lagi di kurs berbeda, angkanya bergeser
// dari modal sebenarnya dan jual semua meninggalkan sisa balance. Dengan rumus ini, average cost × sisa unit
// selalu sama dengan modal tersisa (accounts.balance tanpa saldo awal).
// Satu-satunya sumber rumus ini: dipakai jual (validasi + snapshot) dan tampilan form.
export async function getForexAverageCostPerUnit(db: Db, accountId: string): Promise<number> {
  const [purchaseRows, saleRows] = await Promise.all([
    db.select<{ cost: number | null; unit: number | null }[]>(
      "SELECT SUM(unit * rate) AS cost, SUM(unit) AS unit FROM forex_purchases WHERE account_id = $1",
      [accountId]
    ),
    db.select<{ cost: number | null; unit: number | null }[]>(
      "SELECT SUM(unit * average_cost_per_unit) AS cost, SUM(unit) AS unit FROM forex_sales WHERE account_id = $1",
      [accountId]
    ),
  ]);

  const remainingUnit = (purchaseRows[0]?.unit ?? 0) - (saleRows[0]?.unit ?? 0);
  if (!(remainingUnit > 0)) return 0;
  const remainingCost = (purchaseRows[0]?.cost ?? 0) - (saleRows[0]?.cost ?? 0);
  return remainingCost / remainingUnit;
}

// Sisa unit yang bisa dijual = SUM(unit beli) − SUM(unit jual). Tanpa filter status (tidak ada pending).
export async function getForexRemainingUnit(db: Db, accountId: string): Promise<number> {
  const [purchaseRows, saleRows] = await Promise.all([
    db.select<{ total_unit: number | null }[]>(
      "SELECT SUM(unit) AS total_unit FROM forex_purchases WHERE account_id = $1",
      [accountId]
    ),
    db.select<{ total_unit: number | null }[]>(
      "SELECT SUM(unit) AS total_unit FROM forex_sales WHERE account_id = $1",
      [accountId]
    ),
  ]);
  return (purchaseRows[0]?.total_unit ?? 0) - (saleRows[0]?.total_unit ?? 0);
}
