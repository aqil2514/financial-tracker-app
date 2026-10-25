import { FilterPanel } from "@/components/query/filters/panel";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { FilterKeyOption, SelectOptionsMap } from "@/components/query/filters/panel/panel.interface";

export const TRANSACTION_FILTER_CONFIG: FilterKeyOption[] = [
  { key: "note", label: "Catatan", type: "text" },
  { key: "description", label: "Deskripsi", type: "text" },
  { key: "type", label: "Tipe Transaksi", type: "select" },
  { key: "category_id", label: "Kategori", type: "combobox" },
  { key: "account_id", label: "Akun", type: "combobox" },
  { key: "amount", label: "Jumlah", type: "number" },
  { key: "has_attachment", label: "Gambar", type: "select" },
  { key: "label", label: "Label", type: "combobox" },
  { key: "source", label: "Sumber Data", type: "select" },
];

interface TransactionHeaderFilterProps {
  filters: FilterConfig[];
  selectOptions?: SelectOptionsMap;
  onApplyFilter: (state: FilterConfig[]) => void;
}

export function TransactionHeaderFilter({
  filters,
  selectOptions,
  onApplyFilter,
}: TransactionHeaderFilterProps) {
  return (
    <FilterPanel
      config={TRANSACTION_FILTER_CONFIG}
      selectOptions={selectOptions}
      initialValue={filters}
      onApplyFilter={onApplyFilter}
    />
  );
}
