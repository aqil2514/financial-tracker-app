import { FilterPanel } from "@/components/query/filters/panel";
import { FilterKeyOption } from "@/components/query/filters/panel/panel.interface";
import { useList } from "../context";

const FILTER_CONFIG: FilterKeyOption[] = [
  { key: "note", label: "Catatan", type: "text" },
  { key: "description", label: "Deskripsi", type: "text" },
  { key: "type", label: "Tipe Transaksi", type: "select" },
  { key: "category_id", label: "Kategori", type: "combobox" },
  { key: "account_id", label: "Akun", type: "combobox" },
  { key: "amount", label: "Jumlah", type: "number" },
  { key: "has_attachment", label: "Gambar", type: "select" },
];

export function TransactionListFilter() {
  const { filters, setFilters, filterSelectOptions } = useList().filter;
  return (
    <FilterPanel
      config={FILTER_CONFIG}
      selectOptions={filterSelectOptions}
      initialValue={filters}
      onApplyFilter={setFilters}
    />
  );
}
