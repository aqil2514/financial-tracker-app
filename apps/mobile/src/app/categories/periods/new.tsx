import { Stack } from "expo-router";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function NewCategoryPeriodPage() {
  return (
    <>
      <Stack.Screen options={{ title: "Tambah Periode" }} />
      <View className="flex-1 items-center justify-center gap-3 bg-white px-8">
        <Ionicons name="construct-outline" size={40} color="#a3a3a3" />
        <Text className="text-center text-base font-medium text-neutral-500">
          Form Periode Kategori masih dalam pengembangan
        </Text>
      </View>
    </>
  );
}
