import { SortDropdown, SortKeyOption } from "@/components/query/sort";
import { useList } from "../context";

// Harus sinkron dengan SORTABLE_COLUMNS di use-transactions.ts.
const SORT_CONFIG: SortKeyOption[] = [
  { key: "date", label: "Tanggal" },
  { key: "amount", label: "Jumlah" },
];

export function TransactionListSort() {
  const { sorts, setSorts } = useList().filter;
  return (
    <SortDropdown config={SORT_CONFIG} value={sorts} onChange={setSorts} />
  );
}
