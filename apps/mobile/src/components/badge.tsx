import { Text, View } from "react-native";

type BadgeVariant = "neutral" | "income" | "expense";

const VARIANT_CLASSES: Record<BadgeVariant, { bg: string; text: string }> = {
  neutral: { bg: "bg-neutral-100", text: "text-neutral-700" },
  income: { bg: "bg-emerald-100", text: "text-emerald-700" },
  expense: { bg: "bg-red-100", text: "text-red-700" },
};

export function Badge({ label, variant = "neutral" }: { label: string; variant?: BadgeVariant }) {
  const { bg, text } = VARIANT_CLASSES[variant];

  return (
    <View className={`rounded-full px-2 py-0.5 ${bg}`}>
      <Text className={`text-xs ${text}`}>{label}</Text>
    </View>
  );
}
