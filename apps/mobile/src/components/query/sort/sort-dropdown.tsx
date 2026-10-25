import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useCallback, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { OptionPicker, type OptionPickerRef } from "../shared/option-picker";
import type { SortConfig, SortDirection, SortKeyOption } from "./sort.interface";

interface SortDropdownProps {
  config: SortKeyOption[];
  value: SortConfig[];
  onChange: (value: SortConfig[]) => void;
}

const DIRECTION_OPTIONS: { value: SortDirection; label: string }[] = [
  { value: "asc", label: "Naik" },
  { value: "desc", label: "Turun" },
];

// Dropdown sort sederhana (bukan infrastruktur sebesar filter panel):
// tiap baris pilih kolom + arah, bisa tambah baris untuk multi-sort.
export function SortDropdown({ config, value, onChange }: SortDropdownProps) {
  const sheetRef = useRef<BottomSheetModal>(null);

  const usedKeys = new Set(value.map((sort) => sort.sortKey));
  const availableKeys = config.filter((option) => !usedKeys.has(option.key));

  const handlePresent = useCallback(() => {
    sheetRef.current?.present();
  }, []);

  function handleAdd() {
    if (availableKeys.length === 0) return;
    onChange([...value, { sortKey: availableKeys[0].key, sortDirection: "asc" }]);
  }

  function handleKeyChange(index: number, sortKey: string) {
    onChange(value.map((sort, i) => (i === index ? { ...sort, sortKey } : sort)));
  }

  function handleDirectionChange(index: number, sortDirection: SortDirection) {
    onChange(value.map((sort, i) => (i === index ? { ...sort, sortDirection } : sort)));
  }

  function handleRemove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <>
      <Pressable
        className="flex-row items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5"
        onPress={handlePresent}
      >
        <Text className="text-sm font-medium text-neutral-900">
          Urutkan{value.length > 0 ? ` (${value.length})` : ""}
        </Text>
      </Pressable>

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["100%"]}
        enableDynamicSizing={false}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
        )}
      >
        <BottomSheetScrollView className="flex-1 px-4 pb-4" contentContainerClassName="gap-3">
          <Text className="text-lg font-semibold text-neutral-900">Urutkan Data</Text>

          {value.length === 0 && <Text className="text-sm text-neutral-500">Belum ada urutan.</Text>}

          {value.map((sort, index) => (
            <SortRow
              key={sort.sortKey}
              sort={sort}
              config={config}
              usedKeys={usedKeys}
              onKeyChange={(sortKey) => handleKeyChange(index, sortKey)}
              onDirectionChange={(sortDirection) => handleDirectionChange(index, sortDirection)}
              onRemove={() => handleRemove(index)}
            />
          ))}

          <Pressable
            className="items-center rounded-md border border-neutral-300 px-4 py-3 disabled:opacity-50"
            disabled={availableKeys.length === 0}
            onPress={handleAdd}
          >
            <Text className="font-medium text-neutral-900">Tambah urutan</Text>
          </Pressable>
        </BottomSheetScrollView>
      </BottomSheetModal>
    </>
  );
}

interface SortRowProps {
  sort: SortConfig;
  config: SortKeyOption[];
  usedKeys: Set<string>;
  onKeyChange: (sortKey: string) => void;
  onDirectionChange: (direction: SortDirection) => void;
  onRemove: () => void;
}

function SortRow({ sort, config, onKeyChange, onDirectionChange, onRemove }: SortRowProps) {
  const keyPickerRef = useRef<OptionPickerRef>(null);
  const activeLabel = config.find((opt) => opt.key === sort.sortKey)?.label;

  return (
    <View className="flex-row items-center gap-1.5">
      <Pressable
        className="flex-1 rounded-md border border-neutral-300 px-3 py-2"
        onPress={() => keyPickerRef.current?.present()}
      >
        <Text className="text-neutral-900">{activeLabel ?? "Pilih kolom"}</Text>
      </Pressable>
      <OptionPicker
        ref={keyPickerRef}
        title="Pilih Kolom"
        options={config.map((opt) => ({ value: opt.key, label: opt.label }))}
        value={sort.sortKey}
        onSelect={onKeyChange}
      />

      <View className="flex-row overflow-hidden rounded-md border border-neutral-300">
        {DIRECTION_OPTIONS.map((opt) => {
          const isActive = sort.sortDirection === opt.value;
          return (
            <Pressable
              key={opt.value}
              className={isActive ? "bg-neutral-900 px-3 py-2" : "px-3 py-2"}
              onPress={() => onDirectionChange(opt.value)}
            >
              <Text className={isActive ? "text-white" : "text-neutral-900"}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable className="rounded-md border border-neutral-300 px-3 py-2" onPress={onRemove}>
        <Text className="text-neutral-900">×</Text>
      </Pressable>
    </View>
  );
}
