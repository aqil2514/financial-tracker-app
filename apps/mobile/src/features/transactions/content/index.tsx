import { SectionList, Text, View } from "react-native";
import { TransactionItem } from "./transaction-list-item";
import { formatDateLabel, groupByDate } from "../utils";
import type { TransactionListItem } from "../types";

interface TransactionListProps {
  transactions: TransactionListItem[];
  isLoading: boolean;
}

export function TransactionList({ transactions, isLoading }: TransactionListProps) {
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
