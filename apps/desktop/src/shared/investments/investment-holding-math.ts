import { getDb } from "@/lib/db";

type Db = Awaited<ReturnType<typeof getDb>>;

/**
 * Average cost per unit SAAT INI = `SUM(unit × price_per_unit) / SUM(unit)`
 * dari `investment_purchases` berstatus `settled` SAJA milik akun ini —
 * lihat docs/concept/konsep-investasi.md bagian "Cost basis: average cost,
 * bukan FIFO atau manual". Baris dengan unit/price NULL (order pending
 * yang belum tahu nilainya) otomatis tidak ikut (WHERE status='settled'
 * sudah menyaring, dan baris settled tidak pernah NULL — divalidasi di
 * schema.ts form pembelian).
 *
 * Satu-satunya sumber rumus ini — dipakai `apply-sell-investment-transaction.ts`
 * (validasi oversell + snapshot `realized_pl`) DAN `use-investment-holding-summary.ts`
 * (tampilan form jual) DAN `use-create-investment-sale.ts` (nominal leg
 * transfer utama) supaya ketiganya TIDAK PERNAH bisa drift satu sama lain.
 */
export async function getAverageCostPerUnit(db: Db, accountId: string): Promise<number> {
  const rows = await db.select<{ total_cost: number | null; total_unit: number | null }[]>(
    `SELECT SUM(unit * price_per_unit) AS total_cost, SUM(unit) AS total_unit
     FROM investment_purchases
     WHERE account_id = $1 AND status = 'settled'`,
    [accountId]
  );
  const totalUnit = rows[0]?.total_unit ?? 0;
  if (!totalUnit) return 0;
  return (rows[0]?.total_cost ?? 0) / totalUnit;
}

/**
 * Sisa unit yang BISA DIJUAL saat ini — rumus KHUSUS untuk validasi
 * oversell + average cost, BUKAN `total_unit` yang dipakai Unrealized P/L
 * di halaman detail (yang mengikutkan pending+settled, lihat
 * konsep-investasi.md "Settlement tertunda"):
 *
 *   sisa_unit = SUM(unit, purchases WHERE status='settled')
 *             − SUM(unit, sales WHERE status IN ('pending','settled'))
 *
 * Pembelian yang masih pending TIDAK ikut dihitung sebagai unit yang bisa
 * dijual (belum pasti nilainya) — tapi penjualan pending SUDAH dikurangi
 * (optimis, simetris dengan pembelian, lihat migrasi 0039).
 */
export async function getRemainingUnit(db: Db, accountId: string): Promise<number> {
  const [purchaseRows, saleRows] = await Promise.all([
    db.select<{ total_unit: number | null }[]>(
      `SELECT SUM(unit) AS total_unit FROM investment_purchases WHERE account_id = $1 AND status = 'settled'`,
      [accountId]
    ),
    db.select<{ total_unit: number | null }[]>(
      `SELECT SUM(unit) AS total_unit FROM investment_sales WHERE account_id = $1 AND status IN ('pending', 'settled')`,
      [accountId]
    ),
  ]);

  const settledPurchased = purchaseRows[0]?.total_unit ?? 0;
  const sold = saleRows[0]?.total_unit ?? 0;
  return settledPurchased - sold;
}
