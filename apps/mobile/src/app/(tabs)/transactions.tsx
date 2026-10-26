import { useState } from "react";
import { View } from "react-native";
import { TransactionHeader } from "@/features/transactions/header";
import { TransactionList } from "@/features/transactions/content";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { SortConfig } from "@/components/query/sort/sort.interface";

export default function TransactionsPage() {
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [sorts, setSorts] = useState<SortConfig[]>([]);

  return (
    <View className="flex-1 bg-white">
      <TransactionHeader
        filters={filters}
        onFiltersChange={setFilters}
        sorts={sorts}
        onSortsChange={setSorts}
      />
      <TransactionList filters={filters} sorts={sorts} />
    </View>
  );
}
