export type SortDirection = "asc" | "desc";

export interface SortConfig {
  sortKey: string;
  sortDirection: SortDirection;
}

// Dipakai sebagai pilihan key di UI sorter — konsep milik UI,
// bukan kontainer sort generik.
export interface SortKeyOption {
  key: string;
  label: string;
}
