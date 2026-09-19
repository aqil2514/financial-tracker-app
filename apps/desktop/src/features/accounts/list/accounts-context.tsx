"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { SelectOptionsMap } from "@/components/query/filters/panel/panel.interface";
import type { SortConfig } from "@/components/query/sort";
import { useAccountGroups } from "@/hooks/resources/use-account-groups";
import type { Pagination } from "@/lib/pagination";
import { useAccountsPaginated } from "./use-accounts-paginated";
import type { AccountWithBalance } from "./calculate-balance";

interface AccountsContextType {
  accounts: AccountWithBalance[] | undefined;
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
  showInactive: boolean;
  setShowInactive: (showInactive: boolean) => void;
}

const AccountsContext = createContext<AccountsContextType | undefined>(undefined);

export function AccountsProvider({ children }: { children: React.ReactNode }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [sorts, setSorts] = useState<SortConfig[]>([]);
  const [showInactive, setShowInactive] = useState(false);

  // Gabungkan filter dari FilterPanel dengan is_active dari switch
  // "Tampilkan nonaktif" — kontrak FilterConfig[] yang dikonsumsi
  // useAccountsPaginated tidak berubah, cuma sumber UI-nya dipecah dua.
  const combinedFilters = useMemo<FilterConfig[]>(
    () =>
      showInactive
        ? filters
        : [...filters, { filterKey: "is_active", filterValue: "1", filterOperator: "eq" }],
    [filters, showInactive]
  );

  const { data, isLoading, error } = useAccountsPaginated(page, limit, sorts, combinedFilters);
  const { data: groups } = useAccountGroups();

  useEffect(() => {
    setPage(1);
  }, [filters, sorts, showInactive]);

  const filterSelectOptions = useMemo<SelectOptionsMap>(
    () => ({
      group_id: (groups ?? []).map((group) => ({
        value: String(group.id),
        label: group.name,
      })),
    }),
    [groups]
  );

  return (
    <AccountsContext.Provider
      value={{
        accounts: data?.accounts,
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
        showInactive,
        setShowInactive,
      }}
    >
      {children}
    </AccountsContext.Provider>
  );
}

export function useAccountsList() {
  const context = useContext(AccountsContext);
  if (!context) {
    throw new Error("useAccountsList must be used within AccountsProvider");
  }
  return context;
}
