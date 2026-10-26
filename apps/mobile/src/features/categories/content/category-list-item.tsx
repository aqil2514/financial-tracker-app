import { Pressable, Text, View } from "react-native";
import { Badge } from "@/components/badge";
import { CategoryListItem as CategoryListItemType } from "../types";
import { CategoryStatusDot } from "./category-status-dot";

const TYPE_LABEL = {
  income: "Pemasukan",
  expense: "Pengeluaran",
};

export function CategoryListItem({ category }: { category: CategoryListItemType }) {
  return (
    <Pressable className="flex-row items-center justify-between rounded-lg border border-neutral-200 bg-white p-3">
      <View className="flex-row items-center gap-2">
        <CategoryStatusDot isActive={category.isActive} />
        <Text className="font-medium text-neutral-900">{category.name}</Text>
      </View>
      <Badge label={TYPE_LABEL[category.type]} variant={category.type} />
    </Pressable>
  );
}
