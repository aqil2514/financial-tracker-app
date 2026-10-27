import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Badge } from "@/components/badge";
import { CategoryListItem as CategoryListItemType } from "../types";
import { CategoryStatusDot } from "./category-status-dot";

const TYPE_LABEL = {
  income: "Pemasukan",
  expense: "Pengeluaran",
};

export function CategoryListItem({
  category,
  onToggleActive,
}: {
  category: CategoryListItemType;
  onToggleActive: (id: string, nextIsActive: boolean) => void;
}) {
  const router = useRouter();

  return (
    <Pressable
      className="flex-row items-center justify-between rounded-lg border border-neutral-200 bg-white p-3"
      onPress={() =>
        router.push({ pathname: "/categories/[id]/edit", params: { id: category.id } })
      }
    >
      <View className="flex-row items-center gap-2">
        <CategoryStatusDot
          isActive={category.isActive}
          onToggle={() => onToggleActive(category.id, !category.isActive)}
        />
        <Text className="font-medium text-neutral-900">{category.name}</Text>
      </View>
      <Badge label={TYPE_LABEL[category.type]} variant={category.type} />
    </Pressable>
  );
}
