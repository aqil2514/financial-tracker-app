import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export function accountLabelsQueryKey(accountId: string) {
  return ["account-labels", accountId];
}

/** Sama persis use-transaction-labels.ts, tabel `account_labels`. */
export function useAccountLabels(accountId: string) {
  return useQuery({
    queryKey: accountLabelsQueryKey(accountId),
    queryFn: async () => {
      const db = await getDb();
      const rows = await db.select<{ name: string }[]>(
        `SELECT l.name as name
         FROM account_labels al
         JOIN labels l ON l.id = al.label_id
         WHERE al.account_id = $1 AND al.deleted_at IS NULL AND l.deleted_at IS NULL
         ORDER BY l.name COLLATE NOCASE`,
        [accountId]
      );
      return rows.map((row) => row.name);
    },
  });
}
