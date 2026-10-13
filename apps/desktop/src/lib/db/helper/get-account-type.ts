import { Account, getDb } from "..";

type Db = Awaited<ReturnType<typeof getDb>>;

export async function getAccountType(
  db: Db,
  accountId: string,
): Promise<Account["account_type"] | null> {
  const rows = await db.select<Pick<Account, "account_type">[]>(
    "SELECT account_type FROM accounts WHERE id = $1",
    [accountId],
  );
  return rows[0]?.account_type ?? null;
}
