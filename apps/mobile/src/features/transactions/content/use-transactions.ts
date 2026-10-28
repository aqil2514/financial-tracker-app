import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useDatabase } from "@/lib/database";
import { buildWhereClause } from "@/components/query/filters/builders/sql";
import { buildOrderClause } from "@/components/query/sort/builders/sql";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { SortConfig } from "@/components/query/sort/sort.interface";
import { TransactionListItem } from "../types";

interface TransactionRow {
  id: string;
  note: string;
  description: string | null;
  type: "income" | "expense" | "transfer";
  amount: number;
  date: string;
  category_id: string | null;
  category_name: string | null;
  account_id: string;
  account_name: string | null;
  transfer_account_id: string | null;
  transfer_account_name: string | null;
  has_attachment: number;
}

// Kolom yang boleh dipakai sebagai filterKey/sortKey — harus sinkron
// dengan skema tabel transactions (lib/database/migrations/0001_initial.ts)
// dan TRANSACTION_FILTER_CONFIG/TRANSACTION_SORT_CONFIG di features/transactions/header/.
const ALLOWED_FILTER_COLUMNS = [
  "note",
  "description",
  "type",
  "category_id",
  "account_id",
  "amount",
  "has_attachment",
  "date",
] as const;

const ALLOWED_SORT_COLUMNS = ["date", "amount"] as const;

const DEFAULT_ORDER = "date DESC, created_at DESC";

function toListItem(row: TransactionRow): TransactionListItem {
  return {
    id: row.id,
    note: row.note,
    description: row.description,
    type: row.type,
    category: row.category_name,
    account: row.account_name ?? row.account_id,
    transferAccount: row.transfer_account_name,
    amount: row.amount,
    date: row.date,
    hasAttachment: row.has_attachment === 1,
  };
}

// buildWhereClause/buildOrderClause generate placeholder gaya Postgres
// ($1, $2, ...), sedangkan expo-sqlite (seperti SQLite pada umumnya)
// pakai placeholder posisional "?". $N hanya perlu diganti jadi "?" —
// urutan params dari builder sudah sesuai urutan kemunculan $N di string.
function toPositionalPlaceholders(clause: string): string {
  return clause.replace(/\$\d+/g, "?");
}

interface UseTransactionsOptions {
  filters?: FilterConfig[];
  sorts?: SortConfig[];
}

// Query ulang tiap halaman Transaksi mendapat fokus (termasuk
// pertama kali mount, dan tiap balik dari halaman Tambah Transaksi)
// — belum ada invalidation/cache layer (React Query dkk) di mobile,
// jadi refetch manual lewat useFocusEffect untuk sekarang. Tidak ada
// useEffect terpisah untuk initial load karena useFocusEffect sudah
// fire saat screen pertama kali fokus — menambah useEffect lagi
// cuma duplikasi fetch pertama.
export function useTransactions({ filters = [], sorts = [] }: UseTransactionsOptions = {}) {
  const db = useDatabase();
  const [transactions, setTransactions] = useState<TransactionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const { whereClause, params } = buildWhereClause(filters, ALLOWED_FILTER_COLUMNS);
      const orderClause = buildOrderClause(sorts, ALLOWED_SORT_COLUMNS, DEFAULT_ORDER);

      const sql = toPositionalPlaceholders(
        `SELECT transactions.*,
                (SELECT name FROM categories WHERE categories.id = transactions.category_id) as category_name,
                (SELECT name FROM accounts WHERE accounts.id = transactions.account_id) as account_name,
                (SELECT name FROM accounts WHERE accounts.id = transactions.transfer_account_id) as transfer_account_name
         FROM transactions
         ${whereClause} ${orderClause}`
      );

      const rows = await db.getAllAsync<TransactionRow>(sql, params);
      setTransactions(rows.map(toListItem));
    } finally {
      setIsLoading(false);
    }
  }, [db, filters, sorts]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  return { transactions, isLoading, refetch };
}
