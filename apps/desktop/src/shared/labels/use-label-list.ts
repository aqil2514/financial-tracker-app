import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";
import type { LabelScope } from "./use-labels";

export type LabelWithUsage = {
  id: string;
  name: string;
  scope: LabelScope;
  transaction_count: number;
  category_count: number;
  account_count: number;
};

// Prefix ["labels"] sama dengan labelsQueryKey(scope), jadi invalidate ["labels"] menyegarkan keduanya.
export const labelListQueryKey = ["labels", "list"];

/** Semua label aktif (lintas scope) beserta jumlah pemakaiannya -- dipakai halaman Master Data > Label. */
export function useLabelList() {
  return useQuery({
    queryKey: labelListQueryKey,
    queryFn: async () => {
      const db = await getDb();
      return db.select<LabelWithUsage[]>(
        `SELECT l.id, l.name, l.scope,
           (SELECT COUNT(*) FROM transaction_labels tl WHERE tl.label_id = l.id AND tl.deleted_at IS NULL) AS transaction_count,
           (SELECT COUNT(*) FROM category_labels cl WHERE cl.label_id = l.id AND cl.deleted_at IS NULL) AS category_count,
           (SELECT COUNT(*) FROM account_labels al WHERE al.label_id = l.id AND al.deleted_at IS NULL) AS account_count
         FROM labels l
         WHERE l.deleted_at IS NULL
         ORDER BY l.name COLLATE NOCASE`
      );
    },
  });
}
