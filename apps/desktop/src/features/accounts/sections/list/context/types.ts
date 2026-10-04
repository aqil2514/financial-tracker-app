import type { useQueryState } from "nuqs";

import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { SelectOptionsMap } from "@/components/query/filters/panel/panel.interface";
import type { SortConfig } from "@/components/query/sort";
import type { Pagination } from "@/lib/pagination";
import type { AccountWithBalance } from "../../../calculate-balance";

export type AccountDialogType = "detail" | "correction" | "edit" | "delete";
export type AccountsTab = "ringkasan" | "detail";

// activeTab/page/limit/filters/sorts/showInactive hidup di URL query
// string (nuqs) supaya tidak hilang saat refresh — setter-nya karena itu
// punya signature useQueryState (menerima updater fn, return Promise).
type QueryStateSetter<T> = ReturnType<typeof useQueryState<T>>[1];

export interface AccountsContextType {
  activeTab: AccountsTab;
  setActiveTab: QueryStateSetter<AccountsTab>;
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
  /** Akun yang sedang jadi target salah satu dialog (Detail/Koreksi/Edit/
   * Hapus) — null kalau tidak ada dialog yang terbuka. Dipakai supaya
   * ke-4 dialog itu cukup di-render SEKALI di level list (bukan per
   * item), bukan 4 instance × jumlah baris. */
  activeAccount: AccountWithBalance | null;
  activeDialog: AccountDialogType | null;
  openDialog: (account: AccountWithBalance, dialog: AccountDialogType) => void;
  closeDialog: () => void;
}
