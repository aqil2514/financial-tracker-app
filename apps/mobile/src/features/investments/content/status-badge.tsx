import { Text, View } from "react-native";

const STATUS_STYLE = {
  pending: { label: "Pending", bg: "bg-amber-100", text: "text-amber-700" },
  settled: { label: "Settled", bg: "bg-neutral-100", text: "text-neutral-600" },
};

export function StatusBadge({ status }: { status: "pending" | "settled" }) {
  const { label, bg, text } = STATUS_STYLE[status];

  return (
    <View className={`rounded-full px-2 py-0.5 ${bg}`}>
      <Text className={`text-xs font-medium ${text}`}>{label}</Text>
    </View>
  );
}
