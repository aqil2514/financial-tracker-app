import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { SelectOptionsMap } from "@/components/query/filters/panel/panel.interface";
import type { SortConfig } from "@/components/query/sort";
import type { Pagination } from "@/lib/pagination";
import type { AccountWithBalance } from "../../../calculate-balance";

export type AccountDialogType = "detail" | "correction" | "edit" | "delete";

export interface AccountsContextType {
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
  /** Akun yang sedang jadi target salah satu dialog (Detail/Koreksi/Edit/
   * Hapus) — null kalau tidak ada dialog yang terbuka. Dipakai supaya
   * ke-4 dialog itu cukup di-render SEKALI di level list (bukan per
   * item), bukan 4 instance × jumlah baris. */
  activeAccount: AccountWithBalance | null;
  activeDialog: AccountDialogType | null;
  openDialog: (account: AccountWithBalance, dialog: AccountDialogType) => void;
  closeDialog: () => void;
}
