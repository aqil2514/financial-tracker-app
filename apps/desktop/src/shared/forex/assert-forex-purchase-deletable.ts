import type { getDb } from "@/lib/db";
import { getForexRemainingUnit } from "./forex-holding-math";

type Db = Awaited<ReturnType<typeof getDb>>;

export class ForexPurchaseDeleteBlockedError extends Error {
  constructor(remainingAfterDelete: number) {
    super(
      `Pembelian valas ini tidak bisa dihapus karena unitnya sudah terpakai penjualan ` +
        `(sisa unit akan menjadi ${remainingAfterDelete}). Hapus penjualannya dulu.`
    );
    this.name = "ForexPurchaseDeleteBlockedError";
  }
}

// Toleransi untuk noise floating point pada unit berdesimal.
const UNIT_EPSILON = 1e-9;

// Dipanggil SEBELUM menghapus transaksi: kalau transaksi ini pembelian valas dan menghapusnya membuat sisa
// unit akun negatif (unitnya sudah terpakai penjualan), hapus ditolak. Menghapus penjualan, atau pembelian yang
// unitnya belum terpakai, selalu lolos.
export async function assertForexPurchaseDeletable(db: Db, transactionId: string): Promise<void> {
  const purchases = await db.select<{ account_id: string; unit: number }[]>(
    "SELECT account_id, unit FROM forex_purchases WHERE transaction_id = $1",
    [transactionId]
  );

  const unitByAccount = new Map<string, number>();
  for (const purchase of purchases) {
    unitByAccount.set(purchase.account_id, (unitByAccount.get(purchase.account_id) ?? 0) + purchase.unit);
  }

  for (const [accountId, removedUnit] of unitByAccount) {
    const remainingAfterDelete = (await getForexRemainingUnit(db, accountId)) - removedUnit;
    if (remainingAfterDelete < -UNIT_EPSILON) {
      throw new ForexPurchaseDeleteBlockedError(remainingAfterDelete);
    }
  }
}
