import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useDatabase } from "@/lib/database";
import type { TransactionListItem } from "./transaction-list-item";

interface TransactionRow {
  id: string;
  note: string;
  description: string | null;
  type: "income" | "expense" | "transfer";
  amount: number;
  date: string;
  category_id: string | null;
  account_id: string;
  transfer_account_id: string | null;
  has_attachment: number;
}

function toListItem(row: TransactionRow): TransactionListItem {
  return {
    id: row.id,
    note: row.note,
    description: row.description,
    type: row.type,
    category: row.category_id,
    account: row.account_id,
    transferAccount: row.transfer_account_id,
    amount: row.amount,
    date: row.date,
    hasAttachment: row.has_attachment === 1,
  };
}

// Query ulang tiap halaman Transaksi mendapat fokus (termasuk
// pertama kali mount, dan tiap balik dari halaman Tambah Transaksi)
// — belum ada invalidation/cache layer (React Query dkk) di mobile,
// jadi refetch manual lewat useFocusEffect untuk sekarang. Tidak ada
// useEffect terpisah untuk initial load karena useFocusEffect sudah
// fire saat screen pertama kali fokus — menambah useEffect lagi
// cuma duplikasi fetch pertama.
export function useTransactions() {
  const db = useDatabase();
  const [transactions, setTransactions] = useState<TransactionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await db.getAllAsync<TransactionRow>(
        "SELECT * FROM transactions ORDER BY date DESC, created_at DESC"
      );
      setTransactions(rows.map(toListItem));
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  return { transactions, isLoading, refetch };
}
