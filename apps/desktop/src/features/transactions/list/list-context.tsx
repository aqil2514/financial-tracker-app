"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { SelectOptionsMap } from "@/components/query/filters/panel/panel.interface";
import type { SortConfig } from "@/components/query/sort";
import { useAccounts, type AccountWithBalance } from "@/features/accounts";
import { useCategories } from "@/features/categories";
import type { Category, Transaction } from "@/lib/db";
import type { Pagination } from "@/lib/pagination";
import { useTransactionsPage } from "../page/transactions-page-context";
import { useTransactions } from "./use-transactions";
import { useDeleteTransaction } from "./use-delete-transaction";

const STATIC_FILTER_SELECT_OPTIONS: SelectOptionsMap = {
  type: [
    { value: "income", label: "Pemasukan" },
    { value: "expense", label: "Pengeluaran" },
    { value: "transfer", label: "Transfer" },
  ],
  has_attachment: [
    { value: "1", label: "Ada gambar" },
    { value: "0", label: "Tidak ada gambar" },
  ],
};

interface ListContextType {
  transactions: Transaction[] | undefined;
  pagination: Pagination | undefined;
  isLoading: boolean;
  error: Error | null;
  page: number;
  setPage: (page: number) => void;
  limit: number;
  setLimit: (limit: number) => void;
  filters: FilterConfig[];
  setFilters: (filters: FilterConfig[]) => void;
  filterSelectOptions: SelectOptionsMap;
  sorts: SortConfig[];
  setSorts: (sorts: SortConfig[]) => void;
  accountName: (id: number | null) => string;
  categoryName: (id: number | null) => string | null;
  deleteTransaction: (id: number) => void;
  isDeletingTransaction: boolean;
}

const ListContext = createContext<ListContextType | undefined>(undefined);

export function ListProvider({ children }: { children: React.ReactNode }) {
  const { dateFilter } = useTransactionsPage();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [sorts, setSorts] = useState<SortConfig[]>([]);

  const { data, isLoading, error } = useTransactions(
    page,
    limit,
    dateFilter,
    sorts,
    filters
  );

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, filters, sorts]);

  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const deleteTransaction = useDeleteTransaction();

  const filterSelectOptions = useMemo<SelectOptionsMap>(
    () => ({
      ...STATIC_FILTER_SELECT_OPTIONS,
      category_id: (categories ?? []).map((category: Category) => ({
        value: String(category.id),
        label: category.name,
      })),
      account_id: (accounts ?? []).map((account: AccountWithBalance) => ({
        value: String(account.id),
        label: account.name,
      })),
    }),
    [categories, accounts]
  );

  function accountName(id: number | null) {
    return accounts?.find((account) => account.id === id)?.name ?? "-";
  }

  function categoryName(id: number | null) {
    return categories?.find((category) => category.id === id)?.name ?? null;
  }

  return (
    <ListContext.Provider
      value={{
        transactions: data?.transactions,
        pagination: data?.pagination,
        isLoading,
        error: error as Error | null,
        page,
        setPage,
        limit,
        setLimit,
        filters,
        setFilters,
        filterSelectOptions,
        sorts,
        setSorts,
        accountName,
        categoryName,
        deleteTransaction: deleteTransaction.mutate,
        isDeletingTransaction: deleteTransaction.isPending,
      }}
    >
      {children}
    </ListContext.Provider>
  );
}

export function useList() {
  const context = useContext(ListContext);
  if (!context) {
    throw new Error("useList must be used within ListProvider");
  }
  return context;
}
