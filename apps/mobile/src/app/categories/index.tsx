import { useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CategoryFilterSheet,
  type CategoryFilterSheetRef,
} from "@/features/categories/content/category-filter-sheet";
import { CategoryList } from "@/features/categories/content/category-list";
import { useCategories } from "@/features/categories/content/use-categories";
import { defaultCategoryFilter, filterCategories } from "@/features/categories/utils/filter-categories";

export default function CategoriesPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { categories, isLoading } = useCategories();
  const [filter, setFilter] = useState(defaultCategoryFilter);
  const filterSheetRef = useRef<CategoryFilterSheetRef>(null);

  const activeFilterCount =
    (filter.search !== "" ? 1 : 0) +
    (filter.type !== "all" ? 1 : 0) +
    (filter.status !== "all" ? 1 : 0);

  const filteredCategories = useMemo(
    () => filterCategories(categories, filter),
    [categories, filter]
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: "Kategori",
          headerRight: () => (
            <Pressable
              className="flex-row items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5"
              onPress={() => filterSheetRef.current?.present()}
            >
              <Text className="text-sm font-medium text-neutral-900">Filter</Text>
              {activeFilterCount > 0 && (
                <View className="min-w-5 items-center rounded-full bg-neutral-900 px-1.5">
                  <Text className="text-xs font-medium text-white">{activeFilterCount}</Text>
                </View>
              )}
            </Pressable>
          ),
        }}
      />
      <View className="flex-1 bg-white">
        <CategoryList
          categories={filteredCategories}
          isLoading={isLoading}
          hasAnyCategory={categories.length > 0}
        />

        <Pressable
          className="absolute right-5 size-14 items-center justify-center rounded-full bg-neutral-900 shadow-lg"
          style={{ bottom: insets.bottom + 20 }}
          onPress={() => router.push("/categories/new")}
        >
          <Text className="text-2xl text-white">+</Text>
        </Pressable>

        <CategoryFilterSheet
          ref={filterSheetRef}
          filter={filter}
          onChange={setFilter}
          activeCount={activeFilterCount}
        />
      </View>
    </>
  );
}
