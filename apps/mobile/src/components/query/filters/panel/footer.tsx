import type { Dispatch, SetStateAction } from "react";
import { Pressable, Text, View } from "react-native";
import type { FilterConfig } from "../filter.interface";
import { DEFAULT_OPERATOR } from "./default-operator";
import type { FilterKeyOption } from "./panel.interface";

interface FilterPanelFooterProps {
  config: FilterKeyOption[];
  snapshot: FilterConfig[];
  setSnapshot: Dispatch<SetStateAction<FilterConfig[]>>;
  onApplyFilter: (state: FilterConfig[]) => void;
  onClose: () => void;
}

// Controlled component murni — lihat catatan di content.tsx soal
// kenapa ini tidak boleh baca useFilterPanel() secara langsung
// (dirender di dalam BottomSheetModal, yang di-hoist via Portal).
export function FilterPanelFooter({
  config,
  snapshot,
  setSnapshot,
  onApplyFilter,
  onClose,
}: FilterPanelFooterProps) {
  // Field yang belum dipakai di snapshot
  const usedKeys = snapshot.map((f) => f.filterKey);
  const nextConfig = config.find((c) => !usedKeys.includes(c.key));
  const allUsed = !nextConfig;

  const handleAdd = () => {
    if (!nextConfig) return;
    setSnapshot((prev) => [
      ...prev,
      {
        filterKey: nextConfig.key,
        filterOperator: DEFAULT_OPERATOR[nextConfig.type],
        filterValue: null,
      },
    ]);
  };

  const handleApply = () => {
    const validFilters = snapshot.filter((f) => f.filterKey !== "");
    onApplyFilter(validFilters);
    onClose();
  };

  return (
    <View className="flex-row justify-between gap-2">
      <Pressable
        className="flex-1 items-center rounded-md border border-neutral-300 px-4 py-3 disabled:opacity-50"
        onPress={handleAdd}
        disabled={allUsed}
      >
        <Text className="font-medium text-neutral-900">Tambah Filter</Text>
      </Pressable>
      <Pressable
        className="flex-1 items-center rounded-md bg-neutral-900 px-4 py-3"
        onPress={handleApply}
      >
        <Text className="font-medium text-white">Terapkan Filter</Text>
      </Pressable>
    </View>
  );
}
