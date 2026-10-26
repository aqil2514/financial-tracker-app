import { View } from "react-native";
import { PageHeader } from "@/components/page-header";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { SortConfig } from "@/components/query/sort/sort.interface";
import { TransactionHeaderFilter } from "./filter";
import { TransactionHeaderSort } from "./sort";

interface TransactionHeaderProps {
  filters: FilterConfig[];
  onFiltersChange: (filters: FilterConfig[]) => void;
  sorts: SortConfig[];
  onSortsChange: (sorts: SortConfig[]) => void;
}

export function TransactionHeader({
  filters,
  onFiltersChange,
  sorts,
  onSortsChange,
}: TransactionHeaderProps) {
  return (
    <PageHeader
      title="Transaksi"
      actions={
        <View className="flex-row items-center gap-2">
          <TransactionHeaderSort sorts={sorts} onChange={onSortsChange} />
          <TransactionHeaderFilter filters={filters} onApplyFilter={onFiltersChange} />
        </View>
      }
    />
  );
}
