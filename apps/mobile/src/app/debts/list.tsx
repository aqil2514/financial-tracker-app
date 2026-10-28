import { Stack } from "expo-router";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function DebtsListPage() {
  return (
    <>
      <Stack.Screen options={{ title: "Utang Piutang" }} />
      <View className="flex-1 items-center justify-center gap-3 bg-white px-8">
        <Ionicons name="swap-horizontal-outline" size={40} color="#a3a3a3" />
        <Text className="text-center text-base font-medium text-neutral-700">
          Daftar Utang & Piutang
        </Text>
        <Text className="text-center text-sm text-neutral-500">
          Halaman ini masih dalam pengembangan.
        </Text>
      </View>
    </>
  );
}
