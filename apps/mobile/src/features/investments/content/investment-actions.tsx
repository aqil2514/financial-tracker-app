import { Alert, Pressable, Text, View } from "react-native";

const ACTIONS = [
  { label: "Catat Pembelian", message: "Form pembelian belum tersedia." },
  { label: "Jual", message: "Form penjualan belum tersedia." },
  { label: "Write-off", message: "Form write-off belum tersedia." },
];

export function InvestmentActions() {
  return (
    <View className="flex-row gap-2">
      {ACTIONS.map((action) => (
        <Pressable
          key={action.label}
          className="flex-1 items-center rounded-md border border-neutral-300 py-2"
          onPress={() => Alert.alert("Segera hadir", action.message)}
        >
          <Text className="text-sm font-medium text-neutral-900">{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
