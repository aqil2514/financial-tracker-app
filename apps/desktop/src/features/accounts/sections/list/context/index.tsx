"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { SelectOptionsMap } from "@/components/query/filters/panel/panel.interface";
import type { SortConfig } from "@/components/query/sort";
import { useAccountGroups } from "@/hooks/resources/use-account-groups";
import type { AccountWithBalance } from "../../../calculate-balance";
import { useAccountsPaginated } from "../use-accounts-paginated";
import type { AccountDialogType, AccountsContextType } from "./types";

export type { AccountDialogType } from "./types";

const AccountsContext = createContext<AccountsContextType | undefined>(undefined);

export function AccountsProvider({ children }: { children: React.ReactNode }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [sorts, setSorts] = useState<SortConfig[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [activeAccount, setActiveAccount] = useState<AccountWithBalance | null>(null);
  const [activeDialog, setActiveDialog] = useState<AccountDialogType | null>(null);

  function openDialog(account: AccountWithBalance, dialog: AccountDialogType) {
    setActiveAccount(account);
    setActiveDialog(dialog);
  }

  function closeDialog() {
    setActiveDialog(null);
  }

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
        activeAccount,
        activeDialog,
        openDialog,
        closeDialog,
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
