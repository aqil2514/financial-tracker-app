import type { SQLiteDatabase } from "expo-sqlite";
import { PUSH_TABLE_ORDER } from "./types";

// Trigger antrean hanya menangkap perubahan setelah ia ada; baris yang sudah ada sebelumnya tidak pernah
// masuk antrean, sehingga baris anak ditolak Worker karena induknya tidak ada. Ini memasukkan SEMUA baris
// yang ada. Entry yang sudah ada (mis. delete menunggu) dibiarkan.
export async function enqueueAllRows(db: SQLiteDatabase): Promise<number> {
  let total = 0;
  await db.withTransactionAsync(async () => {
    for (const table of PUSH_TABLE_ORDER) {
      const key = table === "investment_accounts" || table === "forex_accounts" ? "account_id" : "id";
      const before = await db.getFirstAsync<{ total: number }>("SELECT COUNT(*) AS total FROM cloud_sync_queue");
      await db.runAsync(
        `INSERT INTO cloud_sync_queue (table_name, row_id, op)
         SELECT '${table}', ${key}, 'upsert' FROM ${table} WHERE true
         ON CONFLICT (table_name, row_id) DO NOTHING`
      );
      const after = await db.getFirstAsync<{ total: number }>("SELECT COUNT(*) AS total FROM cloud_sync_queue");
      total += (after?.total ?? 0) - (before?.total ?? 0);
    }
  });
  return total;
}
