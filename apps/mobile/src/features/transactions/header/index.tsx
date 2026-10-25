import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { PageHeader } from "@/components/page-header";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { SortConfig } from "@/components/query/sort/sort.interface";
import { TransactionHeaderFilter } from "./filter";
import { TransactionHeaderSort } from "./sort";

export function TransactionHeader() {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [sorts, setSorts] = useState<SortConfig[]>([]);

  return (
    <PageHeader
      title="Transaksi"
      actions={
        <View className="flex-row items-center gap-2">
          <TransactionHeaderSort sorts={sorts} onChange={setSorts} />
          <TransactionHeaderFilter filters={filters} onApplyFilter={setFilters} />
          <Pressable
            className="rounded-md bg-neutral-900 px-3 py-1.5"
            onPress={() => router.push("/transactions/new")}
          >
            <Text className="text-sm font-medium text-white">+ Tambah</Text>
          </Pressable>
        </View>
      }
    />
  );
}
