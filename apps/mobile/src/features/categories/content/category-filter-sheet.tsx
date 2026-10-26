import { forwardRef, useImperativeHandle, useRef } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import {
  CategoryFilterState,
  CategoryStatusFilter,
  CategoryTypeFilter,
} from "../utils/filter-categories";

const TYPE_OPTIONS: { value: CategoryTypeFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "income", label: "Pemasukan" },
  { value: "expense", label: "Pengeluaran" },
];

const STATUS_OPTIONS: { value: CategoryStatusFilter; label: string }[] = [
  { value: "all", label: "Semua Status" },
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Nonaktif" },
];

// Toggle group standalone (bukan react-hook-form) — versi filter dari
// FormFieldToggleGroup, dipakai di sini karena ini filter list, bukan
// field form.
function FilterToggleGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            className={
              isActive
                ? "rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1.5"
                : "rounded-full border border-neutral-300 px-3 py-1.5"
            }
            onPress={() => onChange(option.value)}
          >
            <Text className={isActive ? "text-xs font-medium text-white" : "text-xs text-neutral-700"}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface CategoryFilterSheetRef {
  present: () => void;
}

interface CategoryFilterSheetProps {
  filter: CategoryFilterState;
  onChange: (filter: CategoryFilterState) => void;
  activeCount: number;
}

// Isi filter dipindah ke bottom sheet (bukan bar permanen di bawah page
// header) supaya tidak motong tinggi area list — dibuka lewat tombol
// "Filter" di header, snap ke 45% viewport (cukup buat search + 2 toggle
// group, tidak perlu full 100% seperti FilterPanel transaksi yang
// kontrolnya jauh lebih banyak).
export const CategoryFilterSheet = forwardRef<CategoryFilterSheetRef, CategoryFilterSheetProps>(
  function CategoryFilterSheet({ filter, onChange, activeCount }, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);

    useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
    }));

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["45%"]}
        enableDynamicSizing={false}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
        )}
      >
        <BottomSheetView className="flex-1 gap-4 px-4 pb-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-neutral-900">Filter Kategori</Text>
            {activeCount > 0 && (
              <Pressable onPress={() => onChange({ search: "", type: "all", status: "all" })}>
                <Text className="text-sm font-medium text-neutral-500">Reset</Text>
              </Pressable>
            )}
          </View>

          <TextInput
            value={filter.search}
            onChangeText={(search) => onChange({ ...filter, search })}
            placeholder="Cari kategori..."
            className="rounded-md border border-neutral-300 px-3 py-2 text-neutral-900"
          />

          <View className="gap-2">
            <Text className="text-sm font-medium text-neutral-700">Tipe</Text>
            <FilterToggleGroup
              value={filter.type}
              options={TYPE_OPTIONS}
              onChange={(type) => onChange({ ...filter, type })}
            />
          </View>

          <View className="gap-2">
            <Text className="text-sm font-medium text-neutral-700">Status</Text>
            <FilterToggleGroup
              value={filter.status}
              options={STATUS_OPTIONS}
              onChange={(status) => onChange({ ...filter, status })}
            />
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);
