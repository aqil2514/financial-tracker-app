import { Text, View } from "react-native";

export function Badge({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-neutral-100 px-2 py-0.5">
      <Text className="text-xs text-neutral-700">{label}</Text>
    </View>
  );
}