import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { FilterConfig } from "../filter.interface";

export type FilterFieldType = "text" | "select" | "number" | "date";

// Dipakai sebagai pilihan field di key selector — konsep milik
// panel (UI), bukan kontainer filter generik. Field pendukung
// khusus per tipe (mis. `options` untuk type "select") diwariskan
// lewat interface turunan, bukan ditambahkan di sini.
export interface FilterKeyOption {
  key: string;
  label: string;
  type: FilterFieldType;
}

export interface FilterPanelContextType {
  config: FilterKeyOption[];
  snapshot: FilterConfig[];
  setSnapshot: Dispatch<SetStateAction<FilterConfig[]>>;
  activeValue: FilterConfig[];
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  onApplyFilter: (state: FilterConfig[]) => void;
}

export interface FilterPanelProviderProps {
  config: FilterKeyOption[];
  initialValue: FilterConfig[];
  onApplyFilter: (state: FilterConfig[]) => void;
  children: ReactNode;
}
