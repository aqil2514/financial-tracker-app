import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatUnit } from "../content/pl";

type SellAllCheckboxProps = {
  checked: boolean;
  remainingUnit: number;
  unitLabel: string;
  onChange: (next: boolean) => void;
};

// Mengisi jumlah unit dengan seluruh sisa yang bisa dijual/dihapus dan mengunci kolomnya.
export function SellAllCheckbox({ checked, remainingUnit, unitLabel, onChange }: SellAllCheckboxProps) {
  const disabled = remainingUnit <= 0;

  return (
    <Pressable
      className="-mt-2 flex-row items-center gap-2 disabled:opacity-40"
      disabled={disabled}
      onPress={() => onChange(!checked)}
    >
      <Ionicons name={checked ? "checkbox" : "square-outline"} size={22} color={checked ? "#171717" : "#737373"} />
      <Text className="text-sm text-neutral-700">
        {`Semua unit (${formatUnit(remainingUnit)} ${unitLabel || "unit"})`}
      </Text>
    </Pressable>
  );
}
