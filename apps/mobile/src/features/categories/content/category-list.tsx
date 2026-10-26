import { FlatList, Text, View } from "react-native";
import { CategoryListItem as CategoryListItemType } from "../types";
import { groupByParent } from "../utils/group-by-parent";
import { CategoryAccordionSection } from "./category-accordion-section";

interface CategoryListProps {
  categories: CategoryListItemType[];
  isLoading: boolean;
  // Beda dari categories.length === 0: ini nunjukin apakah DB-nya memang
  // kosong atau cuma hasil filter yang tidak ada yang cocok — dua pesan
  // kosong itu beda makna buat pengguna (mirip isEmpty vs "belum ada
  // kategori" di desktop).
  hasAnyCategory: boolean;
}

export function CategoryList({ categories, isLoading, hasAnyCategory }: CategoryListProps) {
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
      contentContainerClassName="gap-2 px-4 pb-20"
      renderItem={({ item: section }) => <CategoryAccordionSection section={section} />}
    />
  );
}
