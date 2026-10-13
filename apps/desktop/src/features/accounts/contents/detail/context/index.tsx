"use client";

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { parseAsBoolean, parseAsInteger, parseAsJson, useQueryState } from "nuqs";

import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { SelectOptionsMap } from "@/components/query/filters/panel/panel.interface";
import type { SortConfig } from "@/components/query/sort";
import { useAccountGroups } from "@/hooks/resources/use-account-groups";
import { useAccountsPaginated } from "../use-accounts-paginated";
import type { AccountsContextType } from "./types";

const AccountsContext = createContext<AccountsContextType | undefined>(undefined);

// Fallback eksplisit per field — nuqs butuh ini supaya nilai default tidak
// ikut ditulis ke URL (clearOnDefault) dan tetap konsisten saat param absen.
const filtersParser = parseAsJson<FilterConfig[]>((v) => v as FilterConfig[]).withDefault([]);
const sortsParser = parseAsJson<SortConfig[]>((v) => v as SortConfig[]).withDefault([]);

export function AccountsProvider({ children }: { children: React.ReactNode }) {
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [limit, setLimit] = useQueryState("limit", parseAsInteger.withDefault(20));
  const [filters, setFilters] = useQueryState("filters", filtersParser);
  const [sorts, setSorts] = useQueryState("sorts", sortsParser);
  const [showInactive, setShowInactive] = useQueryState(
    "showInactive",
    parseAsBoolean.withDefault(false)
  );

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

  // Skip di mount pertama — filters/sorts/showInactive bisa langsung
  // berisi nilai non-default saat ini (restore dari URL setelah refresh),
  // dan itu bukan "user mengubah filter" jadi tidak boleh reset page.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
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
