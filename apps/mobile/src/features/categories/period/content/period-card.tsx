import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { CategoryPeriodListItem } from "../types";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function PeriodCard({ period }: { period: CategoryPeriodListItem }) {
  const router = useRouter();

  return (
    <Pressable
      className="gap-2 rounded-lg border border-neutral-200 bg-white p-3"
      onPress={() =>
        router.push({ pathname: "/categories/periods/[id]/edit", params: { id: period.id } })
      }
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="font-semibold text-neutral-900">{period.name}</Text>
          <Text className="text-sm text-neutral-500">
            {formatDate(period.startDate)} - {formatDate(period.endDate)}
          </Text>
        </View>
        {period.isOngoing ? (
          <View className="rounded-full bg-amber-100 px-2 py-0.5">
            <Text className="text-xs text-amber-700">Berlangsung</Text>
          </View>
        ) : (
          <View className="rounded-full bg-emerald-100 px-2 py-0.5">
            <Text className="text-xs text-emerald-700">Selesai</Text>
          </View>
        )}
      </View>
      <Text className="text-xs text-neutral-500" numberOfLines={2}>
        {period.categoryNames}
      </Text>
    </Pressable>
  );
}
