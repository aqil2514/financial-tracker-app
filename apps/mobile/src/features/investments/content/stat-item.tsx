import { Text, View } from "react-native";

export function StatItem({
  label,
  value,
  toneClass = "text-neutral-900",
}: {
  label: string;
  value: string;
  toneClass?: string;
}) {
  return (
    <View className="w-1/2 gap-0.5 py-2 pr-2">
      <Text className="text-xs text-neutral-500">{label}</Text>
      <Text className={`font-medium ${toneClass}`}>{value}</Text>
    </View>
  );
}
