import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetBackdrop, BottomSheetFlatList, BottomSheetModal } from "@gorhom/bottom-sheet";
import { SheetModal } from "@/components/sheet-modal";
import { Ionicons } from "@expo/vector-icons";
import { SheetSearchInput, type SheetSearchInputRef } from "@/components/forms/sheet-search-input";
import { generateId, useDatabase } from "@/lib/database";

interface ContactOptionRow {
  id: string;
  name: string;
}

export interface ContactPickerSheetRef {
  present: () => void;
}

interface ContactPickerSheetProps {
  onSelect: (contact: { id: string; name: string }) => void;
}

export const ContactPickerSheet = forwardRef<ContactPickerSheetRef, ContactPickerSheetProps>(
  function ContactPickerSheet({ onSelect }, ref) {
    const db = useDatabase();
    const insets = useSafeAreaInsets();
    const sheetRef = useRef<BottomSheetModal>(null);
    const searchInputRef = useRef<SheetSearchInputRef>(null);
    const [options, setOptions] = useState<ContactOptionRow[]>([]);
    const [search, setSearch] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    const loadOptions = useCallback(async () => {
      const rows = await db.getAllAsync<ContactOptionRow>(
        `SELECT id, name FROM contacts ORDER BY name ASC`
      );
      setOptions(rows);
    }, [db]);

    useImperativeHandle(ref, () => ({
      present: async () => {
        setSearch("");
        await loadOptions();
        sheetRef.current?.present();
      },
    }));

    const filteredOptions = useMemo(() => {
      const keyword = search.trim().toLowerCase();
      if (!keyword) return options;
      return options.filter((option) => option.name.toLowerCase().includes(keyword));
    }, [options, search]);

    const exactMatch = useMemo(
      () => options.some((option) => option.name.toLowerCase() === search.trim().toLowerCase()),
      [options, search]
    );

    function handleSelect(option: ContactOptionRow) {
      onSelect(option);
      sheetRef.current?.dismiss();
    }

    async function handleCreate() {
      const name = (searchInputRef.current?.getValue() ?? search).trim();
      if (!name) return;

      setIsCreating(true);
      try {
        const id = generateId();
        await db.runAsync(`INSERT INTO contacts (id, name) VALUES (?, ?)`, [id, name]);
        onSelect({ id, name });
        sheetRef.current?.dismiss();
      } finally {
        setIsCreating(false);
      }
    }

    return (
      <SheetModal
        ref={sheetRef}
        snapPoints={["60%"]}
        enableDynamicSizing={false}
        stackBehavior="push"
        android_keyboardInputMode="adjustResize"
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
        )}
      >
        <View className="flex-1 gap-2 px-4" style={{ paddingBottom: insets.bottom + 16 }}>
          <Text className="text-lg font-semibold text-neutral-900">Pilih Kontak</Text>
          <SheetSearchInput
            ref={searchInputRef}
            onChangeDebounced={setSearch}
            placeholder="Cari atau buat kontak baru..."
            autoFocus
          />

          {search.trim() !== "" && !exactMatch && (
            <Pressable
              className="flex-row items-center gap-2 border-b border-neutral-100 py-3 disabled:opacity-50"
              disabled={isCreating}
              onPress={handleCreate}
            >
              <Ionicons name="add-circle-outline" size={20} color="#171717" />
              <Text className="text-neutral-900">
                {isCreating ? "Menyimpan..." : `Buat kontak baru: "${search.trim()}"`}
              </Text>
            </Pressable>
          )}

          {filteredOptions.length === 0 ? (
            <Text className="py-4 text-center text-neutral-500">
              {options.length === 0 ? "Belum ada kontak." : "Tidak ada kontak yang cocok."}
            </Text>
          ) : (
            <BottomSheetFlatList
              data={filteredOptions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  className="border-b border-neutral-100 py-3"
                  onPress={() => handleSelect(item)}
                >
                  <Text className="text-neutral-900">{item.name}</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </SheetModal>
    );
  }
);
