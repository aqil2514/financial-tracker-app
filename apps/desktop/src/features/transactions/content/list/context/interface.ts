import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { SelectOptionsMap } from "@/components/query/filters/panel/panel.interface";
import type { SortConfig } from "@/components/query/sort";
import type { Pagination } from "@/lib/pagination";
import type { TransactionListRow } from "../use-transactions";

export interface ListContextData {
  transactions: TransactionListRow[] | undefined;
  pagination: Pagination | undefined;
  isLoading: boolean;
  error: Error | null;
}

export interface ListContextFilter {
  filters: FilterConfig[];
  setFilters: (filters: FilterConfig[]) => void;
  filterSelectOptions: SelectOptionsMap;
  sorts: SortConfig[];
  setSorts: (sorts: SortConfig[]) => void;
  /** Rentang tanggal dari `PeriodPicker` (`components/query/period-picker`)
   * — terpisah dari `filters` generik karena butuh `date(date) BETWEEN`,
   * bukan operator `buildWhereClause` biasa (lihat `build-where-conditions.ts`). */
  dateRange: { from: string; to: string } | undefined;
  setDateRange: (range: { from: string; to: string } | undefined) => void;
}

export interface ListContextPageControl {
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
}

export interface ListContextLookup {
  accountName: (id: number | null) => string;
  categoryName: (id: number | null) => string | null;
}

export interface ListContextType {
  data: ListContextData;
  filter: ListContextFilter;
  pageControl: ListContextPageControl;
  lookup: ListContextLookup;
}
