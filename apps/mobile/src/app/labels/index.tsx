import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LabelList } from "@/features/labels/content/label-list";
import { useLabels } from "@/features/labels/content/use-labels";

export default function LabelsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { labels, isLoading } = useLabels();
  const [search, setSearch] = useState("");

  const filteredLabels = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return labels;
    return labels.filter((label) => label.name.toLowerCase().includes(keyword));
  }, [labels, search]);

  return (
    <>
      <Stack.Screen options={{ title: "Label" }} />
      <View className="flex-1 bg-white">
        <View className="border-b border-neutral-100 px-4 py-3">
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Cari label..."
            className="rounded-md border border-neutral-300 px-3 py-2 text-neutral-900"
          />
        </View>

        <LabelList
          labels={filteredLabels}
          isLoading={isLoading}
          hasAnyLabel={labels.length > 0}
          onPress={(id) => router.push({ pathname: "/labels/[id]/edit", params: { id } })}
        />

        <Pressable
          className="absolute right-5 size-14 items-center justify-center rounded-full bg-neutral-900 shadow-lg"
          style={{ bottom: insets.bottom + 20 }}
          onPress={() => router.push("/labels/new")}
        >
          <Text className="text-2xl text-white">+</Text>
        </Pressable>
      </View>
    </>
  );
}
