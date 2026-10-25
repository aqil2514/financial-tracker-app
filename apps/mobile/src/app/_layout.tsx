// Wajib paling atas, sebelum import apa pun yang (langsung/tidak
// langsung) memuat `uuid` — Hermes tidak menyediakan
// crypto.getRandomValues() native, dan `uuid` membacanya saat module
// load (bukan lazy), jadi urutan ini kritis.
import "react-native-get-random-values";

import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppDatabaseProvider } from "@/lib/database";
import "../../global.css"

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppDatabaseProvider>
        <BottomSheetModalProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </BottomSheetModalProvider>
      </AppDatabaseProvider>
    </GestureHandlerRootView>
  );
}
