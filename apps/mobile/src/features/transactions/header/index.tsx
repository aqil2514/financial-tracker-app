import { useState } from "react";
import { View } from "react-native";
import { PageHeader } from "@/components/page-header";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { SortConfig } from "@/components/query/sort/sort.interface";
import { TransactionHeaderFilter } from "./filter";
import { TransactionHeaderSort } from "./sort";

export function TransactionHeader() {
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [sorts, setSorts] = useState<SortConfig[]>([]);

  return (
    <PageHeader
      title="Transaksi"
      actions={
        <View className="flex-row items-center gap-2">
          <TransactionHeaderSort sorts={sorts} onChange={setSorts} />
          <TransactionHeaderFilter filters={filters} onApplyFilter={setFilters} />
        </View>
      }
    />
  );
}
