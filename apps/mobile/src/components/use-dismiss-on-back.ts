import { useEffect } from "react";
import { BackHandler } from "react-native";

// BottomSheetModal tidak menangani tombol back Android, jadi back langsung diteruskan ke navigasi (pindah
// halaman dengan sheet masih terbuka). Selama `isOpen`, back menutup sheet saja. Listener back berlaku
// terbalik urutan daftar: sheet yang dibuka belakangan (mis. picker di atas panel filter) menutup duluan.
export function useDismissOnBack(isOpen: boolean, dismiss: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      dismiss();
      return true;
    });
    return () => subscription.remove();
  }, [isOpen, dismiss]);
}
