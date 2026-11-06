import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetBackdrop, BottomSheetFlatList, BottomSheetModal } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { SheetModal } from "@/components/sheet-modal";
import { SheetSearchInput, type SheetSearchInputRef } from "@/components/forms/sheet-search-input";
import { useDatabase } from "@/lib/database";
import type { LabelScope } from "../types";

export interface LabelPickerSheetRef {
  present: () => void;
}

interface LabelPickerSheetProps {
  scope: LabelScope;
  selected: string[];
  onChange: (names: string[]) => void;
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// Multi-select. Nama baru yang diketik hanya ditambahkan ke pilihan; labelnya baru dibuat saat form disimpan.
export const LabelPickerSheet = forwardRef<LabelPickerSheetRef, LabelPickerSheetProps>(
  function LabelPickerSheet({ scope, selected, onChange }, ref) {
    const db = useDatabase();
    const insets = useSafeAreaInsets();
    const sheetRef = useRef<BottomSheetModal>(null);
    const searchInputRef = useRef<SheetSearchInputRef>(null);
    const [names, setNames] = useState<string[]>([]);
    const [search, setSearch] = useState("");

    const loadNames = useCallback(async () => {
      const rows = await db.getAllAsync<{ name: string }>(
        "SELECT name FROM labels WHERE scope = ? ORDER BY name COLLATE NOCASE",
        [scope]
      );
      setNames(rows.map((row) => row.name));
    }, [db, scope]);

    useImperativeHandle(ref, () => ({
      present: async () => {
        setSearch("");
        await loadNames();
        sheetRef.current?.present();
      },
    }));

    // Label yang baru diketik dan belum tersimpan tetap tampil supaya bisa dilepas lagi.
    const options = useMemo(() => {
      const extra = selected.filter((name) => !names.some((existing) => sameName(existing, name)));
      return [...names, ...extra].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    }, [names, selected]);

    const filtered = useMemo(() => {
      const keyword = search.trim().toLowerCase();
      return keyword ? options.filter((name) => name.toLowerCase().includes(keyword)) : options;
    }, [options, search]);

    const typed = search.trim();
    const canCreate = typed !== "" && !options.some((name) => sameName(name, typed));

    function toggle(name: string) {
      const isSelected = selected.some((item) => sameName(item, name));
      onChange(isSelected ? selected.filter((item) => !sameName(item, name)) : [...selected, name]);
    }

    function handleCreate() {
      const name = (searchInputRef.current?.getValue() ?? search).trim();
      if (!name) return;
      onChange([...selected, name]);
    }

    return (
      <SheetModal
        ref={sheetRef}
        snapPoints={["70%"]}
        enableDynamicSizing={false}
        stackBehavior="push"
        android_keyboardInputMode="adjustResize"
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
        )}
      >
        <View className="flex-1 gap-2 px-4" style={{ paddingBottom: insets.bottom + 16 }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-neutral-900">Pilih Label</Text>
            <Pressable onPress={() => sheetRef.current?.dismiss()}>
              <Text className="font-medium text-neutral-900">Selesai</Text>
            </Pressable>
          </View>
          <SheetSearchInput
            ref={searchInputRef}
            onChangeDebounced={setSearch}
            placeholder="Cari atau ketik label baru..."
          />

          {canCreate && (
            <Pressable
              className="flex-row items-center gap-2 border-b border-neutral-100 py-3"
              onPress={handleCreate}
            >
              <Ionicons name="add-circle-outline" size={20} color="#171717" />
              <Text className="text-neutral-900">{`Buat label baru: "${typed}"`}</Text>
            </Pressable>
          )}

          {filtered.length === 0 ? (
            <Text className="py-4 text-center text-neutral-500">
              {options.length === 0 ? "Belum ada label." : "Tidak ada label yang cocok."}
            </Text>
          ) : (
            <BottomSheetFlatList
              data={filtered}
              keyExtractor={(item) => item}
              extraData={selected}
              renderItem={({ item }) => {
                const isSelected = selected.some((name) => sameName(name, item));
                return (
                  <Pressable
                    className="flex-row items-center justify-between border-b border-neutral-100 py-3"
                    onPress={() => toggle(item)}
                  >
                    <Text className="text-neutral-900">{item}</Text>
                    {isSelected && <Ionicons name="checkmark" size={20} color="#171717" />}
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </SheetModal>
    );
  }
);
