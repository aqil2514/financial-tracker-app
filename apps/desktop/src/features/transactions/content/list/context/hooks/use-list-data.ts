import { useEffect } from "react";

import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { SortConfig } from "@/components/query/sort";
import { useTransactions } from "../../use-transactions";
import type { ListContextData } from "../interface";

export function useListData(
  page: number,
  limit: number,
  setPage: (page: number) => void,
  dateFilter: string | undefined,
  sorts: SortConfig[],
  filters: FilterConfig[]
): ListContextData {
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

  return {
    transactions: data?.transactions,
    pagination: data?.pagination,
    isLoading,
    error: error as Error | null,
  };
}
