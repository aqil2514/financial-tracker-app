import { Alert, Pressable, Text, View } from "react-native";

type InvestmentActionsProps = {
  onPressPurchase: () => void;
  onPressSell: () => void;
};

export function InvestmentActions({ onPressPurchase, onPressSell }: InvestmentActionsProps) {
  return (
    <View className="flex-row gap-2">
      <Pressable className="flex-1 items-center rounded-md border border-neutral-300 py-2" onPress={onPressPurchase}>
        <Text className="text-sm font-medium text-neutral-900">Catat Pembelian</Text>
      </Pressable>
      <Pressable className="flex-1 items-center rounded-md border border-neutral-300 py-2" onPress={onPressSell}>
        <Text className="text-sm font-medium text-neutral-900">Jual</Text>
      </Pressable>
      <Pressable
        className="flex-1 items-center rounded-md border border-neutral-300 py-2"
        onPress={() => Alert.alert("Segera hadir", "Form write-off belum tersedia.")}
      >
        <Text className="text-sm font-medium text-neutral-900">Write-off</Text>
      </Pressable>
    </View>
  );
}
