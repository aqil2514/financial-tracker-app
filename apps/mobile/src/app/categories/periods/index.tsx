import { Pressable, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PeriodList } from "@/features/categories/period/content/period-list";
import { useCategoryPeriods } from "@/features/categories/period/content/use-category-periods";

export default function CategoryPeriodsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { periods, isLoading } = useCategoryPeriods();

  return (
    <>
      <Stack.Screen options={{ title: "Periode Kategori" }} />
      <View className="flex-1 bg-white">
        <PeriodList periods={periods} isLoading={isLoading} />

        <Pressable
          className="absolute right-5 size-14 items-center justify-center rounded-full bg-neutral-900 shadow-lg"
          style={{ bottom: insets.bottom + 20 }}
          onPress={() => router.push("/categories/periods/new")}
        >
          <Text className="text-2xl text-white">+</Text>
        </Pressable>
      </View>
    </>
  );
}
