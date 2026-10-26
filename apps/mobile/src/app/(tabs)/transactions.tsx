import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TransactionHeader } from "@/features/transactions/header";
import { TransactionList } from "@/features/transactions/content";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { SortConfig } from "@/components/query/sort/sort.interface";

export default function TransactionsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

      <Pressable
        className="absolute right-5 size-14 items-center justify-center rounded-full bg-neutral-900 shadow-lg"
        style={{ bottom: insets.bottom + 20 }}
        onPress={() => router.push("/transactions/new")}
      >
        <Text className="text-2xl text-white">+</Text>
      </Pressable>
    </View>
  );
}
