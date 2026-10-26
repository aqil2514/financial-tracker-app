import { SectionList, Text, View } from "react-native";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { SortConfig } from "@/components/query/sort/sort.interface";
import { TransactionItem } from "./transaction-list-item";
import { useTransactions } from "./use-transactions";
import { formatDateLabel, groupByDate } from "../utils";

interface TransactionListProps {
  filters?: FilterConfig[];
  sorts?: SortConfig[];
}

export function TransactionList({ filters, sorts }: TransactionListProps) {
  const { transactions, isLoading } = useTransactions({ filters, sorts });
  const sections = groupByDate(transactions);

  if (!isLoading && transactions.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-neutral-500">Belum ada transaksi.</Text>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      contentContainerClassName="px-4 pb-4"
      renderSectionHeader={({ section }) => (
        <Text className="bg-white py-2 text-sm font-semibold text-neutral-500">
          {formatDateLabel(section.title)}
        </Text>
      )}
      renderItem={({ item }) => <TransactionItem transaction={item} />}
      ItemSeparatorComponent={() => <View className="h-2" />}
      SectionSeparatorComponent={() => <View className="h-1" />}
    />
  );
}
