"use client";

import { createContext, useContext } from "react";

import { useAccounts } from "@/features/accounts";
import { useCategories } from "@/features/categories";
import { useTransactionsPage } from "../../../page/transactions-page-context";
import { useListData } from "./hooks/use-list-data";
import { useListFilter } from "./hooks/use-list-filter";
import { useListLookup } from "./hooks/use-list-lookup";
import { useListPageControl } from "./hooks/use-list-page-control";
import type { ListContextType } from "./interface";

const ListContext = createContext<ListContextType | undefined>(undefined);

export function ListProvider({
  children,
  accountId,
}: {
  children: React.ReactNode;
  /** Scoped ke satu akun (dipakai halaman detail akun) — dicocokkan baik
   * sebagai akun utama maupun akun tujuan transfer. Tanpa ini, list
   * menampilkan semua transaksi seperti biasa. */
  accountId?: number;
}) {
  const { dateFilter } = useTransactionsPage();
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();

  const { page, setPage, limit, setLimit } = useListPageControl();
  const filter = useListFilter(categories, accounts);
  const data = useListData(
    page,
    limit,
    setPage,
    dateFilter,
    filter.sorts,
    filter.filters,
    accountId
  );
  const lookup = useListLookup(accounts, categories);

  return (
    <ListContext.Provider value={{ data, filter, pageControl: { setPage, setLimit }, lookup }}>
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
