import { SortDropdown } from "@/components/query/sort";
import type { SortConfig, SortKeyOption } from "@/components/query/sort/sort.interface";

// Harus sinkron dengan kolom yang nanti didukung query transaksi mobile.
const TRANSACTION_SORT_CONFIG: SortKeyOption[] = [
  { key: "date", label: "Tanggal" },
  { key: "amount", label: "Jumlah" },
];

interface TransactionHeaderSortProps {
  sorts: SortConfig[];
  onChange: (sorts: SortConfig[]) => void;
}

export function TransactionHeaderSort({ sorts, onChange }: TransactionHeaderSortProps) {
  return <SortDropdown config={TRANSACTION_SORT_CONFIG} value={sorts} onChange={onChange} />;
}
