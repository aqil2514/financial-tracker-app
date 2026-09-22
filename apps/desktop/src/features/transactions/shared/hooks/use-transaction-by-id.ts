import { useQuery } from "@tanstack/react-query";
import { getDb, type Transaction } from "@/lib/db";
import { transactionsQueryKey } from "../../content/list/use-transactions";

/** Ambil 1 transaksi by id — dipakai untuk buka TransactionEditDialog
 * dari luar list (mis. deep-link ?edit=123 dari dialog detail akun),
 * bukan dari item list yang objeknya sudah ada di tangan. */
export function useTransactionById(transactionId: number | null) {
  return useQuery({
    queryKey: [...transactionsQueryKey, "by-id", transactionId],
    queryFn: async () => {
      const db = await getDb();
      const rows = await db.select<Transaction[]>(
        "SELECT * FROM transactions WHERE id = $1",
        [transactionId]
      );
      return rows[0] ?? null;
    },
    enabled: transactionId != null,
  });
}
