import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
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

// Filters/sort state hidup di halaman (`app/(tabs)/transactions.tsx`),
// bukan di sini — TransactionList di sibling yang sama butuh nilai
// yang sama persis untuk membangun query.
export function TransactionHeader({
  filters,
  onFiltersChange,
  sorts,
  onSortsChange,
}: TransactionHeaderProps) {
  const router = useRouter();

  return (
    <PageHeader
      title="Transaksi"
      actions={
        <View className="flex-row items-center gap-2">
          <TransactionHeaderSort sorts={sorts} onChange={onSortsChange} />
          <TransactionHeaderFilter filters={filters} onApplyFilter={onFiltersChange} />
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
