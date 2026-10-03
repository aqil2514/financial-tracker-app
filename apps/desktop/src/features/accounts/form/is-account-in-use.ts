import { getDb } from "@/lib/db";

type Db = Awaited<ReturnType<typeof getDb>>;

/**
 * Prinsip #3 docs/concept/konsep-tipe-akun.md ("tipe akun permanen
 * setelah dipakai") — "dipakai" = ada baris TIDAK terhapus di salah satu
 * dari 3 tabel finansial yang FK ke accounts (transactions via account_id
 * ATAU transfer_account_id, debts, debt_payments). Port persis dari query
 * yang sama di Worker (isAccountInUse, apps/worker/src/modules/accounts/service.ts)
 * — retailku_sync_field_mapping SENGAJA tidak dihitung, itu konfigurasi
 * mapping bukan histori transaksi. Logic murni (bukan hook) supaya bisa
 * dipanggil dari mutationFn (use-update-account.ts) maupun dibungkus
 * useQuery (use-account-is-used.ts).
 */
export async function isAccountInUse(db: Db, accountId: string): Promise<boolean> {
  const rows = await db.select<{ used: number }[]>(
    `SELECT EXISTS(
       SELECT 1 FROM transactions
       WHERE (account_id = $1 OR transfer_account_id = $1) AND deleted_at IS NULL
       UNION ALL
       SELECT 1 FROM debts WHERE account_id = $1 AND deleted_at IS NULL
       UNION ALL
       SELECT 1 FROM debt_payments WHERE account_id = $1 AND deleted_at IS NULL
     ) AS used`,
    [accountId]
  );
  return rows[0]?.used === 1;
}
