import { Alert, Pressable, Text, View } from "react-native";

const PLACEHOLDER_ACTIONS = [
  { label: "Jual", message: "Form penjualan belum tersedia." },
  { label: "Write-off", message: "Form write-off belum tersedia." },
];

export function InvestmentActions({ onPressPurchase }: { onPressPurchase: () => void }) {
  return (
    <View className="flex-row gap-2">
      <Pressable
        className="flex-1 items-center rounded-md border border-neutral-300 py-2"
        onPress={onPressPurchase}
      >
        <Text className="text-sm font-medium text-neutral-900">Catat Pembelian</Text>
      </Pressable>
      {PLACEHOLDER_ACTIONS.map((action) => (
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
