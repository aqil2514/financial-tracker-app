import { FilterPanel } from "@/components/query/filters/panel";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { FilterKeyOption } from "@/components/query/filters/panel/panel.interface";
import { useTransactionFilterOptions } from "./use-filter-options";

// "Sumber Data" (Retailku import) sengaja belum dimasukkan, fiturnya belum diporting.
export const TRANSACTION_FILTER_CONFIG: FilterKeyOption[] = [
  { key: "note", label: "Catatan", type: "text" },
  { key: "description", label: "Deskripsi", type: "text" },
  { key: "type", label: "Tipe Transaksi", type: "select" },
  { key: "category_id", label: "Kategori", type: "combobox" },
  { key: "account_id", label: "Akun", type: "combobox" },
  { key: "label", label: "Label", type: "combobox" },
  { key: "amount", label: "Jumlah", type: "number" },
  { key: "has_attachment", label: "Gambar", type: "select" },
];

interface TransactionHeaderFilterProps {
  filters: FilterConfig[];
  onApplyFilter: (state: FilterConfig[]) => void;
}

export function TransactionHeaderFilter({ filters, onApplyFilter }: TransactionHeaderFilterProps) {
  const selectOptions = useTransactionFilterOptions();

  return (
    <FilterPanel
      config={TRANSACTION_FILTER_CONFIG}
      selectOptions={selectOptions}
      initialValue={filters}
      onApplyFilter={onApplyFilter}
    />
  );
}
