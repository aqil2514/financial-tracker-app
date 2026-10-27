import { FlatList, Text, View } from "react-native";
import { CategoryListItem as CategoryListItemType } from "../types";
import { groupByParent } from "../utils/group-by-parent";
import { CategoryAccordionSection } from "./category-accordion-section";

interface CategoryListProps {
  categories: CategoryListItemType[];
  isLoading: boolean;
  hasAnyCategory: boolean;
  onToggleActive: (id: string, nextIsActive: boolean) => void;
}

export function CategoryList({
  categories,
  isLoading,
  hasAnyCategory,
  onToggleActive,
}: CategoryListProps) {
  const sections = groupByParent(categories);

  if (!isLoading && categories.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-neutral-500">
          {hasAnyCategory ? "Tidak ada kategori yang cocok dengan filter." : "Belum ada kategori."}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={sections}
      keyExtractor={(section) => section.id}
      contentContainerClassName="gap-2 px-4 pb-20 pt-4"
      renderItem={({ item: section }) => (
        <CategoryAccordionSection section={section} onToggleActive={onToggleActive} />
      )}
    />
  );
}
