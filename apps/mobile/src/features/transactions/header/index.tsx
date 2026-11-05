import { View } from "react-native";
import { MonthNavigator } from "@/components/month-navigator";
import { PageHeader } from "@/components/page-header";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { SortConfig } from "@/components/query/sort/sort.interface";
import { TransactionHeaderFilter } from "./filter";
import { TransactionHeaderSort } from "./sort";

interface TransactionHeaderProps {
  month: string | null;
  onMonthChange: (month: string | null) => void;
  filters: FilterConfig[];
  onFiltersChange: (filters: FilterConfig[]) => void;
  sorts: SortConfig[];
  onSortsChange: (sorts: SortConfig[]) => void;
}

export function TransactionHeader({
  month,
  onMonthChange,
  filters,
  onFiltersChange,
  sorts,
  onSortsChange,
}: TransactionHeaderProps) {
  return (
    <PageHeader
      title={<MonthNavigator month={month} onChange={onMonthChange} />}
      actions={
        <View className="flex-row items-center gap-2">
          <TransactionHeaderSort sorts={sorts} onChange={onSortsChange} />
          <TransactionHeaderFilter filters={filters} onApplyFilter={onFiltersChange} />
        </View>
      }
    />
  );
}
