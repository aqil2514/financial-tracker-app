import { FlatList, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SCOPE_LABEL } from "../scope-options";
import type { LabelListItem } from "../types";

interface LabelListProps {
  labels: LabelListItem[];
  isLoading: boolean;
  hasAnyLabel: boolean;
  onPress: (id: string) => void;
}

export function LabelList({ labels, isLoading, hasAnyLabel, onPress }: LabelListProps) {
  if (!isLoading && labels.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-neutral-500">
          {hasAnyLabel ? "Tidak ada label yang cocok dengan pencarian." : "Belum ada label."}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={labels}
      keyExtractor={(item) => item.id}
      contentContainerClassName="pb-20"
      renderItem={({ item }) => (
        <Pressable
          className="flex-row items-center gap-3 border-b border-neutral-100 px-4 py-3.5"
          onPress={() => onPress(item.id)}
        >
          <Ionicons name="pricetag-outline" size={22} color="#737373" />
          <View className="flex-1">
            <Text className="text-base text-neutral-900">{item.name}</Text>
            <Text className="text-sm text-neutral-500">{SCOPE_LABEL[item.scope]}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}
