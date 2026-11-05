import { Pressable, Text, View } from "react-native";
import { formatCurrency } from "@/lib/utils";
import type { ChildRow } from "./cashflow-detail-data";

interface ChildrenFilterProps {
  options: ChildRow[];
  value: string | null;
  allTotal: number;
  onChange: (value: string | null) => void;
}

export function ChildrenFilter({ options, value, allTotal, onChange }: ChildrenFilterProps) {
  // Tanpa anak (mis. kategori tanpa sub-kategori) filter tidak berguna.
  if (options.length === 0) return null;

  return (
    <View className="rounded-lg border border-neutral-200">
      <Row label="Semua" total={allTotal} active={value === null} onPress={() => onChange(null)} />
      {options.map((option) => (
        <Row
          key={option.value}
          label={option.label}
          total={option.total}
          active={value === option.value}
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
  );
}

function Row({
  label,
  total,
  active,
  onPress,
}: {
  label: string;
  total: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={`flex-row items-center justify-between gap-3 border-b border-neutral-100 px-3 py-3 ${
        active ? "bg-neutral-100" : ""
      }`}
      onPress={onPress}
    >
      <Text className={`flex-1 ${active ? "font-medium text-neutral-900" : "text-neutral-700"}`} numberOfLines={1}>
        {label}
      </Text>
      <Text className="text-sm text-neutral-500">{formatCurrency(total)}</Text>
    </Pressable>
  );
}
