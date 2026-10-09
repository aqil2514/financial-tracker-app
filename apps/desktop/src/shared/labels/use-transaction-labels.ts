import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export function transactionLabelsQueryKey(transactionId: string) {
  return ["transaction-labels", transactionId];
}

/** Nama label (bukan id) yang nempel di 1 transaksi -- dipakai prefill
 * `defaultValues` form edit (field combobox multi-select bekerja dengan
 * nama, pola sama `contact_name`, lihat resolve-label-ids.ts). */
export function useTransactionLabels(transactionId: string) {
  return useQuery({
    queryKey: transactionLabelsQueryKey(transactionId),
    queryFn: async () => {
      const db = await getDb();
      const rows = await db.select<{ name: string }[]>(
        `SELECT l.name as name
         FROM transaction_labels tl
         JOIN labels l ON l.id = tl.label_id
         WHERE tl.transaction_id = $1 AND tl.deleted_at IS NULL AND l.deleted_at IS NULL
         ORDER BY l.name COLLATE NOCASE`,
        [transactionId]
      );
      return rows.map((row) => row.name);
    },
  });
}
