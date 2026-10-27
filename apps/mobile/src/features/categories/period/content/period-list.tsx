import { FlatList, Text, View } from "react-native";
import type { CategoryPeriodListItem } from "../types";
import { PeriodCard } from "./period-card";

export function PeriodList({
  periods,
  isLoading,
}: {
  periods: CategoryPeriodListItem[];
  isLoading: boolean;
}) {
  if (!isLoading && periods.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-neutral-500">Belum ada periode kategori.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={periods}
      keyExtractor={(period) => period.id}
      contentContainerClassName="gap-2 px-4 pb-20 pt-4"
      renderItem={({ item }) => <PeriodCard period={item} />}
    />
  );
}
