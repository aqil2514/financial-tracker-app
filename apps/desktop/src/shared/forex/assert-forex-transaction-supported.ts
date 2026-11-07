import type { getDb } from "@/lib/db";
import { getAccountType } from "@/lib/db/helper";

type Db = Awaited<ReturnType<typeof getDb>>;

// Sementara: beli/jual valas belum punya logic (forex_purchases/forex_sales belum
// ditulis), jadi transaksi yang menyentuh akun valas ditolak eksplisit, bukan
// dibiarkan jatuh jadi transfer kas biasa tanpa riwayat unit. Hapus guard ini
// saat tahap beli/jual selesai (lihat apps/desktop/docs/todos/plan/account-type-forex.md).
export async function assertForexTransactionSupported(
  db: Db,
  accountIds: Array<string | null | undefined>
): Promise<void> {
  for (const accountId of accountIds) {
    if (!accountId) continue;
    if ((await getAccountType(db, accountId)) === "forex") {
      throw new Error(
        "Transaksi pada akun Valas belum didukung. Pencatatan beli/jual valas masih dalam pengerjaan."
      );
    }
  }
}
