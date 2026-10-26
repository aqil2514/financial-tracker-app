import { View } from "react-native";

// Read-only dulu — beda dari desktop yang dot-nya clickable buat toggle
// aktif/nonaktif (lihat CategoryStatusDot di apps/desktop). Toggle aktif
// di mobile belum dikerjakan (lihat porting-category.md), jadi ini murni
// indikator visual sampai logic toggle-nya ada.
export function CategoryStatusDot({ isActive }: { isActive: boolean }) {
  return (
    <View
      className={`size-2 shrink-0 rounded-full ${isActive ? "bg-emerald-500" : "bg-neutral-300"}`}
    />
  );
}
