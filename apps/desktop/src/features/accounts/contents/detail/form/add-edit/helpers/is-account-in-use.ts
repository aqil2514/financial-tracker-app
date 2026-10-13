import { getDb } from "@/lib/db";

type Db = Awaited<ReturnType<typeof getDb>>;

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
