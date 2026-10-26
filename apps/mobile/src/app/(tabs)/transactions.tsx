import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TransactionHeader } from "@/features/transactions/header";
import { TransactionList } from "@/features/transactions/content";
import { TransactionSummary } from "@/features/transactions/content/transaction-summary";
import { useTransactions } from "@/features/transactions/content/use-transactions";
import { TransactionCalendar } from "@/features/transactions/calendar";
import { TransactionTabSwitcher, type TransactionTab } from "@/features/transactions/tab-switcher";
import { replaceDateFilter } from "@/features/transactions/utils/date-filter";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { SortConfig } from "@/components/query/sort/sort.interface";

export default function TransactionsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TransactionTab>("daily");
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [sorts, setSorts] = useState<SortConfig[]>([]);
  const { transactions, isLoading } = useTransactions({ filters, sorts });

  function handleSelectDate(dateKey: string) {
    setFilters((prev) => replaceDateFilter(prev, dateKey));
    setTab("daily");
  }

  return (
    <View className="flex-1 bg-white">
      <TransactionHeader
        filters={filters}
        onFiltersChange={setFilters}
        sorts={sorts}
        onSortsChange={setSorts}
      />
      <TransactionSummary filters={filters} />
      <TransactionTabSwitcher active={tab} onChange={setTab} />

      {tab === "daily" ? (
        <TransactionList transactions={transactions} isLoading={isLoading} />
      ) : (
        <TransactionCalendar onSelectDate={handleSelectDate} />
      )}

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
