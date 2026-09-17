import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { FilterConfig, SelectOption } from "../filter.interface";

export type FilterFieldType = "text" | "select" | "combobox" | "number" | "date";

// Dipakai sebagai pilihan field di key selector — konsep milik
// panel (UI), bukan kontainer filter generik. Field pendukung
// khusus per tipe (mis. `options` untuk type "select") diwariskan
// lewat interface turunan, bukan ditambahkan di sini.
export interface FilterKeyOption {
  key: string;
  label: string;
  type: FilterFieldType;
}

// Daftar pilihan value untuk tiap field bertipe "select", dikunci
// dengan `key` field-nya (mis. { type: [...opsi Pemasukan/dst] }).
export type SelectOptionsMap = Record<string, SelectOption[]>;

export interface FilterPanelContextType {
  config: FilterKeyOption[];
  selectOptions: SelectOptionsMap;
  snapshot: FilterConfig[];
  setSnapshot: Dispatch<SetStateAction<FilterConfig[]>>;
  activeValue: FilterConfig[];
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  onApplyFilter: (state: FilterConfig[]) => void;
}

export interface FilterPanelProviderProps {
  config: FilterKeyOption[];
  selectOptions?: SelectOptionsMap;
  initialValue: FilterConfig[];
  onApplyFilter: (state: FilterConfig[]) => void;
  children: ReactNode;
}
