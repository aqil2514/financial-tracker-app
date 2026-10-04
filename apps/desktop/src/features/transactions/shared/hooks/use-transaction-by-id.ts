import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getDb, type Transaction } from "@/lib/db";
import { transactionsQueryKey } from "../../content/list/use-transactions";

/** Ambil 1 transaksi by id — dipakai untuk buka TransactionEditDialog
 * dari luar list (mis. deep-link ?edit=123 dari dialog detail akun),
 * bukan dari item list yang objeknya sudah ada di tangan. */
export function useTransactionById(transactionId: string | null) {
  const query = useQuery({
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

  // Dialog pemanggil (edit/detail) cuma cek `!transaction` lalu diam-diam
  // `return null` kalau query gagal — tanpa ini, error jadi tidak terlihat
  // sama sekali (dialog seperti tidak merespons klik).
  useEffect(() => {
    if (query.isError) {
      const detail = query.error instanceof Error ? query.error.message : String(query.error);
      toast.error(`Gagal memuat transaksi: ${detail}`);
    }
  }, [query.isError, query.error]);

  return query;
}
