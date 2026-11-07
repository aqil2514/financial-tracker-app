import type { SQLiteDatabase } from "expo-sqlite";
import { getForexRemainingUnit } from "./forex-holding-math";

export class ForexPurchaseDeleteBlockedError extends Error {
  constructor(remainingAfterDelete: number) {
    super(
      `Pembelian valas ini tidak bisa dihapus karena unitnya sudah terpakai penjualan ` +
        `(sisa unit akan menjadi ${remainingAfterDelete}). Hapus penjualannya dulu.`
    );
    this.name = "ForexPurchaseDeleteBlockedError";
  }
}

export type DeletedTransactionForexInfo = {
  deletedPurchaseIds: string[];
  deletedSaleIds: string[];
  // Transaksi pasangan penjualan (leg transfer atau leg selisih kurs) yang ikut terhapus.
  deletedPairedTransactionIds: string[];
};

// Toleransi untuk noise floating point pada unit berdesimal.
const UNIT_EPSILON = 1e-9;

// Dipanggil SEBELUM baris transactions di-hard-delete, di dalam transaksi SQLite yang sama. Riwayat beli/jual valas
// tidak bermakna tanpa transaksi asalnya, jadi dihapus (pola investasi). Menghapus pembelian yang unitnya sudah
// terpakai penjualan DITOLAK (sisa unit tidak boleh negatif). Menghapus salah satu leg penjualan menghapus pasangannya.
export async function detachForexForDeletedTransaction(
  db: SQLiteDatabase,
  transactionId: string
): Promise<DeletedTransactionForexInfo> {
  const info: DeletedTransactionForexInfo = { deletedPurchaseIds: [], deletedSaleIds: [], deletedPairedTransactionIds: [] };

  const purchases = await db.getAllAsync<{ id: string; account_id: string; unit: number }>(
    "SELECT id, account_id, unit FROM forex_purchases WHERE transaction_id = ?",
    [transactionId]
  );

  const removedByAccount = new Map<string, number>();
  for (const purchase of purchases) {
    removedByAccount.set(purchase.account_id, (removedByAccount.get(purchase.account_id) ?? 0) + purchase.unit);
  }
  for (const [accountId, removedUnit] of removedByAccount) {
    const remainingAfterDelete = (await getForexRemainingUnit(db, accountId)) - removedUnit;
    if (remainingAfterDelete < -UNIT_EPSILON) throw new ForexPurchaseDeleteBlockedError(remainingAfterDelete);
  }

  for (const purchase of purchases) {
    await db.runAsync("DELETE FROM forex_purchases WHERE id = ?", [purchase.id]);
    info.deletedPurchaseIds.push(purchase.id);
  }

  const sales = await db.getAllAsync<{ id: string; transaction_id: string | null; adjustment_transaction_id: string | null }>(
    `SELECT id, transaction_id, adjustment_transaction_id FROM forex_sales
     WHERE transaction_id = ? OR adjustment_transaction_id = ?`,
    [transactionId, transactionId]
  );
  for (const sale of sales) {
    await db.runAsync("DELETE FROM forex_sales WHERE id = ?", [sale.id]);
    info.deletedSaleIds.push(sale.id);
    for (const otherId of [sale.transaction_id, sale.adjustment_transaction_id]) {
      if (otherId == null || otherId === transactionId) continue;
      await db.runAsync("DELETE FROM transactions WHERE id = ?", [otherId]);
      info.deletedPairedTransactionIds.push(otherId);
    }
  }

  return info;
}
