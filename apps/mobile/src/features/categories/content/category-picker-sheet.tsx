import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "@/components/badge";
import { generateId, useDatabase } from "@/lib/database";

interface CategoryOptionRow {
  id: string;
  name: string;
  parent_id: string | null;
  has_children: number;
}

const TYPE_LABEL = {
  income: "Pemasukan",
  expense: "Pengeluaran",
};

// Dipisah dari CategoryPickerSheet supaya state `name` (yang berubah tiap
// keystroke) tidak memaksa parent (3 BottomSheetModal + 2 FlatList)
// ikut re-render tiap huruf diketik — re-render seberat itu di tiap
// keystroke bikin ngetik cepat kelihatan "ketinggalan"/kacau urutannya.
function CategoryCreateSheetBody({
  type,
  parentLabel,
  isPending,
  onSubmit,
}: {
  type: "income" | "expense";
  parentLabel: string | null;
  isPending: boolean;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState("");

  return (
    <BottomSheetView className="flex-1 gap-3 px-4 pb-4">
      <Text className="text-lg font-semibold text-neutral-900">
        {parentLabel == null ? "Kategori Baru" : `Sub-kategori Baru — ${parentLabel}`}
      </Text>

      <Badge label={TYPE_LABEL[type]} variant={type} />

      <BottomSheetTextInput
        value={name}
        onChangeText={setName}
        placeholder="Mis. 🍔 Makanan"
        autoFocus
        className="rounded-md border border-neutral-300 px-3 py-2 text-neutral-900"
      />

      <Pressable
        className="items-center rounded-md bg-neutral-900 px-4 py-3 disabled:opacity-50"
        disabled={isPending || name.trim() === ""}
        onPress={() => onSubmit(name.trim())}
      >
        <Text className="font-medium text-white">{isPending ? "Menyimpan..." : "Simpan & Pilih"}</Text>
      </Pressable>
    </BottomSheetView>
  );
}

export interface CategoryPickerSheetRef {
  present: () => void;
}

interface CategoryPickerSheetProps {
  type: "income" | "expense";
  onSelect: (category: { id: string; name: string }) => void;
}

export const CategoryPickerSheet = forwardRef<CategoryPickerSheetRef, CategoryPickerSheetProps>(
  function CategoryPickerSheet({ type, onSelect }, ref) {
    const db = useDatabase();
    const rootSheetRef = useRef<BottomSheetModal>(null);
    const childSheetRef = useRef<BottomSheetModal>(null);
    const createSheetRef = useRef<BottomSheetModal>(null);
    const [rootOptions, setRootOptions] = useState<CategoryOptionRow[]>([]);
    const [childOptions, setChildOptions] = useState<CategoryOptionRow[]>([]);
    const [activeParent, setActiveParent] = useState<{ id: string; name: string } | null>(null);
    const [createParentId, setCreateParentId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [createSessionId, setCreateSessionId] = useState(0);

    const loadRootOptions = useCallback(async () => {
      const rows = await db.getAllAsync<CategoryOptionRow>(
        `SELECT c.id, c.name, c.parent_id,
                EXISTS(SELECT 1 FROM categories child WHERE child.parent_id = c.id) as has_children
         FROM categories c
         WHERE c.type = ? AND c.parent_id IS NULL AND c.is_active = 1
         ORDER BY c.name ASC`,
        [type]
      );
      setRootOptions(rows);
    }, [db, type]);

    useImperativeHandle(ref, () => ({
      present: async () => {
        await loadRootOptions();
        rootSheetRef.current?.present();
      },
    }));

    const openChildren = useCallback(
      async (parent: { id: string; name: string }) => {
        const rows = await db.getAllAsync<CategoryOptionRow>(
          `SELECT id, name, parent_id, 0 as has_children
           FROM categories WHERE parent_id = ? AND is_active = 1 ORDER BY name ASC`,
          [parent.id]
        );
        setChildOptions(rows);
        setActiveParent(parent);
        childSheetRef.current?.present();
      },
      [db]
    );

    function handleSelectRoot(option: CategoryOptionRow) {
      if (option.has_children) {
        openChildren({ id: option.id, name: option.name });
        return;
      }
      onSelect({ id: option.id, name: option.name });
      rootSheetRef.current?.dismiss();
    }

    function handleSelectChild(option: CategoryOptionRow) {
      onSelect({ id: option.id, name: option.name });
      childSheetRef.current?.dismiss();
      rootSheetRef.current?.dismiss();
    }

    function openCreate(parentId: string | null) {
      setCreateParentId(parentId);
      setCreateSessionId((prev) => prev + 1);
      createSheetRef.current?.present();
    }

    async function handleCreateSubmit(name: string) {
      if (!name) return;

      setIsCreating(true);
      try {
        const id = generateId();
        await db.runAsync(
          `INSERT INTO categories (id, name, type, parent_id) VALUES (?, ?, ?, ?)`,
          [id, name, type, createParentId]
        );

        if (createParentId == null) {
          await loadRootOptions();
        } else if (activeParent) {
          await openChildren(activeParent);
        }

        onSelect({ id, name });
        createSheetRef.current?.dismiss();
        childSheetRef.current?.dismiss();
        rootSheetRef.current?.dismiss();
      } finally {
        setIsCreating(false);
      }
    }

    return (
      <>
        <BottomSheetModal
          ref={rootSheetRef}
          snapPoints={["60%"]}
          enableDynamicSizing={false}
          stackBehavior="push"
          backdropComponent={(props) => (
            <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
          )}
        >
          <BottomSheetView className="flex-1 px-4 pb-4">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-neutral-900">Pilih Kategori</Text>
              <Pressable hitSlop={10} onPress={() => openCreate(null)}>
                <Ionicons name="add-circle-outline" size={24} color="#171717" />
              </Pressable>
            </View>
            {rootOptions.length === 0 ? (
              <Text className="py-4 text-center text-neutral-500">
                Belum ada kategori aktif untuk tipe ini.
              </Text>
            ) : (
              <FlatList
                data={rootOptions}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    className="flex-row items-center justify-between border-b border-neutral-100 py-3"
                    onPress={() => handleSelectRoot(item)}
                  >
                    <Text className="text-neutral-900">{item.name}</Text>
                    {item.has_children > 0 && (
                      <Ionicons name="chevron-forward" size={18} color="#a3a3a3" />
                    )}
                  </Pressable>
                )}
              />
            )}
          </BottomSheetView>
        </BottomSheetModal>

        <BottomSheetModal
          ref={childSheetRef}
          snapPoints={["60%"]}
          enableDynamicSizing={false}
          stackBehavior="push"
          backdropComponent={(props) => (
            <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
          )}
        >
          <BottomSheetView className="flex-1 px-4 pb-4">
            <View className="mb-2 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Pressable hitSlop={10} onPress={() => childSheetRef.current?.dismiss()}>
                  <Ionicons name="chevron-back" size={20} color="#171717" />
                </Pressable>
                <Text className="text-lg font-semibold text-neutral-900">{activeParent?.name}</Text>
              </View>
              <Pressable
                hitSlop={10}
                onPress={() => activeParent && openCreate(activeParent.id)}
              >
                <Ionicons name="add-circle-outline" size={24} color="#171717" />
              </Pressable>
            </View>
            <FlatList
              data={childOptions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  className="border-b border-neutral-100 py-3"
                  onPress={() => handleSelectChild(item)}
                >
                  <Text className="text-neutral-900">{item.name}</Text>
                </Pressable>
              )}
            />
          </BottomSheetView>
        </BottomSheetModal>

        <BottomSheetModal
          ref={createSheetRef}
          snapPoints={["40%"]}
          enableDynamicSizing={false}
          stackBehavior="push"
          backdropComponent={(props) => (
            <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
          )}
        >
          <CategoryCreateSheetBody
            key={createSessionId}
            type={type}
            parentLabel={createParentId == null ? null : (activeParent?.name ?? null)}
            isPending={isCreating}
            onSubmit={handleCreateSubmit}
          />
        </BottomSheetModal>
      </>
    );
  }
);
