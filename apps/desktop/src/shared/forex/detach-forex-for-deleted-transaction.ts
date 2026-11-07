import type { getDb } from "@/lib/db";

type Db = Awaited<ReturnType<typeof getDb>>;

export type DeletedTransactionForexInfo = {
  deletedPurchaseIds: string[];
  deletedSaleIds: string[];
  // Transaksi pasangan penjualan (leg transfer atau leg selisih kurs) yang ikut terhapus.
  deletedAdjustmentTransactionIds: string[];
};

// Dipanggil SEBELUM hard-delete baris transactions. Riwayat beli/jual valas tidak bermakna tanpa
// transaksi asalnya, jadi dihapus total (pola sama investasi). Menghapus transaksi leg transfer
// sebuah penjualan ikut menghapus transaksi penyesuaian selisih kurs miliknya.
export async function detachForexForDeletedTransaction(
  db: Db,
  transactionId: string
): Promise<DeletedTransactionForexInfo> {
  const info: DeletedTransactionForexInfo = {
    deletedPurchaseIds: [],
    deletedSaleIds: [],
    deletedAdjustmentTransactionIds: [],
  };

  const purchases = await db.select<{ id: string }[]>(
    "SELECT id FROM forex_purchases WHERE transaction_id = $1",
    [transactionId]
  );
  for (const purchase of purchases) {
    await db.execute("DELETE FROM forex_purchases WHERE id = $1", [purchase.id]);
    info.deletedPurchaseIds.push(purchase.id);
  }

  const sales = await db.select<
    { id: string; transaction_id: string | null; adjustment_transaction_id: string | null }[]
  >(
    `SELECT id, transaction_id, adjustment_transaction_id FROM forex_sales
     WHERE transaction_id = $1 OR adjustment_transaction_id = $1`,
    [transactionId]
  );
  for (const sale of sales) {
    await db.execute("DELETE FROM forex_sales WHERE id = $1", [sale.id]);
    info.deletedSaleIds.push(sale.id);
    // Dua leg saling bergantung: menghapus salah satunya menghapus pasangannya juga.
    for (const otherId of [sale.transaction_id, sale.adjustment_transaction_id]) {
      if (otherId == null || otherId === transactionId) continue;
      await db.execute("DELETE FROM transactions WHERE id = $1", [otherId]);
      info.deletedAdjustmentTransactionIds.push(otherId);
    }
  }

  return info;
}
