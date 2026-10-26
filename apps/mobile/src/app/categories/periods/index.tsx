import { Pressable, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function CategoryPeriodsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen options={{ title: "Periode Kategori" }} />
      <View className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Ionicons name="calendar-outline" size={40} color="#a3a3a3" />
          <Text className="text-center text-base font-medium text-neutral-500">
            Belum ada periode kategori. Tambah periode pertamamu.
          </Text>
        </View>

        <Pressable
          className="absolute right-5 size-14 items-center justify-center rounded-full bg-neutral-900 shadow-lg"
          style={{ bottom: insets.bottom + 20 }}
          onPress={() => router.push("/categories/periods/new")}
        >
          <Text className="text-2xl text-white">+</Text>
        </Pressable>
      </View>
    </>
  );
}
