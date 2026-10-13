import type { useQueryState } from "nuqs";

import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { SelectOptionsMap } from "@/components/query/filters/panel/panel.interface";
import type { SortConfig } from "@/components/query/sort";
import type { Pagination } from "@/lib/pagination";
import type { AccountWithBalance } from "../../../calculate-balance";

// page/limit/filters/sorts/showInactive hidup di URL query string (nuqs)
// supaya tidak hilang saat refresh — setter-nya karena itu punya
// signature useQueryState (menerima updater fn, return Promise).
// Dialog state (akun+tipe dialog yang aktif) TIDAK lagi di sini -- lihat
// contents/detail/dialog/context.tsx (createDialogQueryContext).
type QueryStateSetter<T> = ReturnType<typeof useQueryState<T>>[1];

export interface AccountsContextType {
  accounts: AccountWithBalance[] | undefined;
  pagination: Pagination | undefined;
  isLoading: boolean;
  error: Error | null;
  page: number;
  setPage: QueryStateSetter<number>;
  limit: number;
  setLimit: QueryStateSetter<number>;
  filters: FilterConfig[];
  setFilters: QueryStateSetter<FilterConfig[]>;
  filterSelectOptions: SelectOptionsMap;
  sorts: SortConfig[];
  setSorts: QueryStateSetter<SortConfig[]>;
  showInactive: boolean;
  setShowInactive: QueryStateSetter<boolean>;
}
