import { Text, TextInput, View } from "react-native";

function toDigitsOnly(text: string): string {
  return text.replace(/\D/g, "");
}

function formatGrouped(digits: string): string {
  if (digits === "") return "";
  return Number(digits).toLocaleString("id-ID");
}

interface CurrentBalanceFieldProps {
  value: string;
  onChangeText: (digits: string) => void;
}

export function CurrentBalanceField({ value, onChangeText }: CurrentBalanceFieldProps) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-neutral-700">Saldo Terkini</Text>
      <View className="flex-row items-center rounded-md border border-neutral-300">
        <Text className="pl-3 text-neutral-500">Rp</Text>
        <TextInput
          keyboardType="numeric"
          value={formatGrouped(value)}
          onChangeText={(text) => onChangeText(toDigitsOnly(text))}
          selectTextOnFocus
          className="flex-1 px-3 py-2 text-neutral-900"
        />
      </View>
      <Text className="text-xs text-neutral-500">
        Ubah nilai ini untuk mengoreksi saldo lewat transaksi penyesuaian, bukan mengedit riwayat
        transaksi satu-satu.
      </Text>
    </View>
  );
}
