"use client";

import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

/** Prinsip #3 `docs/concept/konsep-tipe-akun.md` ("tipe akun permanen
 * setelah dipakai") — "dipakai" = ada baris TIDAK terhapus di salah satu
 * dari 3 tabel finansial yang FK ke `accounts` (`transactions` via
 * `account_id` ATAU `transfer_account_id`, `debts`, `debt_payments`).
 * Port persis dari query yang sama di Worker (`isAccountInUse`,
 * apps/worker/src/modules/accounts/service.ts). Duplikat kecil dari
 * `features/accounts/contents/detail/form/add-edit/helpers/` — dipakai
 * di sini karena dialog edit akun di halaman ini (`account-edit-dialog.tsx`)
 * lintas fitur, bukan bagian internal `contents/detail/` akun. */
export function useAccountIsUsed(accountId: string | undefined) {
  return useQuery({
    queryKey: ["accounts", "is-used", accountId],
    enabled: accountId != null,
    queryFn: async (): Promise<boolean> => {
      const db = await getDb();
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
    },
  });
}
