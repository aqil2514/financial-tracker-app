import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { FlatList, Keyboard, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { generateId, useDatabase } from "@/lib/database";
import { AccountForm } from "@/features/accounts/form/account-form";
import { emptyAccountValues } from "@/features/accounts/form/values";
import type { AccountFormOutput, AccountFormValues } from "@/features/accounts/form/schema";

interface AccountRootOptionRow {
  kind: "group" | "account" | "create-account";
  id: string;
  name: string;
}

const CREATE_ACCOUNT_ROW: AccountRootOptionRow = {
  kind: "create-account",
  id: "__create_account__",
  name: "Akun Baru",
};

interface AccountChildOptionRow {
  id: string;
  name: string;
}

export interface AccountPickerSheetRef {
  present: () => void;
}

interface AccountPickerSheetProps {
  onSelect: (account: { id: string; name: string }) => void;
}

export const AccountPickerSheet = forwardRef<AccountPickerSheetRef, AccountPickerSheetProps>(
  function AccountPickerSheet({ onSelect }, ref) {
    const db = useDatabase();
    const insets = useSafeAreaInsets();
    const rootSheetRef = useRef<BottomSheetModal>(null);
    const childSheetRef = useRef<BottomSheetModal>(null);
    const createSheetRef = useRef<BottomSheetModal>(null);
    const createGroupSheetRef = useRef<BottomSheetModal>(null);
    const [rootOptions, setRootOptions] = useState<AccountRootOptionRow[]>([]);
    const [childOptions, setChildOptions] = useState<AccountChildOptionRow[]>([]);
    const [activeGroup, setActiveGroup] = useState<{ id: string; name: string } | null>(null);
    const [createDefaultValues, setCreateDefaultValues] = useState<AccountFormValues | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);

    const loadRootOptions = useCallback(async () => {
      const groups = await db.getAllAsync<{ id: string; name: string }>(
        `SELECT id, name FROM account_groups ORDER BY name ASC`
      );
      const ungroupedAccounts = await db.getAllAsync<{ id: string; name: string }>(
        `SELECT id, name FROM accounts WHERE group_id IS NULL AND is_active = 1 ORDER BY name ASC`
      );

      setRootOptions([
        CREATE_ACCOUNT_ROW,
        ...groups.map((group) => ({ kind: "group" as const, id: group.id, name: group.name })),
        ...ungroupedAccounts.map((account) => ({
          kind: "account" as const,
          id: account.id,
          name: account.name,
        })),
      ]);
    }, [db]);

    useImperativeHandle(ref, () => ({
      present: async () => {
        await loadRootOptions();
        rootSheetRef.current?.present();
      },
    }));

    const openChildren = useCallback(
      async (group: { id: string; name: string }) => {
        const rows = await db.getAllAsync<AccountChildOptionRow>(
          `SELECT id, name FROM accounts WHERE group_id = ? AND is_active = 1 ORDER BY name ASC`,
          [group.id]
        );
        setChildOptions(rows);
        setActiveGroup(group);
        childSheetRef.current?.present();
      },
      [db]
    );

    function handleSelectRoot(option: AccountRootOptionRow) {
      if (option.kind === "create-account") {
        openCreate(null);
        return;
      }
      if (option.kind === "group") {
        openChildren({ id: option.id, name: option.name });
        return;
      }
      onSelect({ id: option.id, name: option.name });
      rootSheetRef.current?.dismiss();
    }

    function handleSelectChild(option: AccountChildOptionRow) {
      onSelect({ id: option.id, name: option.name });
      childSheetRef.current?.dismiss();
      rootSheetRef.current?.dismiss();
    }

    function openCreate(groupId: string | null) {
      setCreateDefaultValues({ ...emptyAccountValues(), group_id: groupId });
      createSheetRef.current?.present();
    }

    function openCreateGroup() {
      createGroupSheetRef.current?.present();
    }

    async function handleCreateGroupSubmit(values: AccountFormOutput) {
      if (values.kind !== "group") return;

      setIsCreatingGroup(true);
      try {
        await db.runAsync(`INSERT INTO account_groups (id, name) VALUES (?, ?)`, [
          generateId(),
          values.name,
        ]);
        await loadRootOptions();
        createGroupSheetRef.current?.dismiss();
      } finally {
        setIsCreatingGroup(false);
      }
    }

    async function handleCreateSubmit(values: AccountFormOutput) {
      if (values.kind !== "account") return;

      setIsCreating(true);
      try {
        const id = generateId();
        await db.runAsync(
          `INSERT INTO accounts (id, name, icon, color, group_id, initial_balance, description, is_active, account_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            values.name,
            values.icon,
            values.color,
            values.group_id,
            values.initial_balance,
            values.description,
            values.is_active === "true" ? 1 : 0,
            values.account_type,
          ]
        );

        if (values.group_id == null) {
          await loadRootOptions();
        } else if (activeGroup) {
          await openChildren(activeGroup);
        }

        onSelect({ id, name: values.name });
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
          android_keyboardInputMode="adjustResize"
          onChange={(index) => {
            if (index >= 0) Keyboard.dismiss();
          }}
          backdropComponent={(props) => (
            <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
          )}
        >
          <View className="flex-1 px-4" style={{ paddingBottom: insets.bottom + 16 }}>
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-neutral-900">Pilih Akun</Text>
              <Pressable
                className="flex-row items-center gap-1"
                hitSlop={10}
                onPress={openCreateGroup}
              >
                <Ionicons name="add-circle-outline" size={20} color="#171717" />
                <Text className="text-sm font-medium text-neutral-900">Grup</Text>
              </Pressable>
            </View>
            <FlatList
              data={rootOptions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) =>
                item.kind === "create-account" ? (
                  <Pressable
                    className="flex-row items-center gap-2 border-b border-neutral-100 py-3"
                    onPress={() => handleSelectRoot(item)}
                  >
                    <Ionicons name="add-circle-outline" size={18} color="#171717" />
                    <Text className="font-medium text-neutral-900">{item.name}</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    className="flex-row items-center justify-between border-b border-neutral-100 py-3"
                    onPress={() => handleSelectRoot(item)}
                  >
                    <Text className="text-neutral-900">{item.name}</Text>
                    {item.kind === "group" && (
                      <Ionicons name="chevron-forward" size={18} color="#a3a3a3" />
                    )}
                  </Pressable>
                )
              }
            />
          </View>
        </BottomSheetModal>

        <BottomSheetModal
          ref={childSheetRef}
          snapPoints={["60%"]}
          enableDynamicSizing={false}
          stackBehavior="push"
          android_keyboardInputMode="adjustResize"
          onChange={(index) => {
            if (index >= 0) Keyboard.dismiss();
          }}
          backdropComponent={(props) => (
            <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
          )}
        >
          <View className="flex-1 px-4" style={{ paddingBottom: insets.bottom + 16 }}>
            <View className="mb-2 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Pressable hitSlop={10} onPress={() => childSheetRef.current?.dismiss()}>
                  <Ionicons name="chevron-back" size={20} color="#171717" />
                </Pressable>
                <Text className="text-lg font-semibold text-neutral-900">{activeGroup?.name}</Text>
              </View>
              <Pressable hitSlop={10} onPress={() => activeGroup && openCreate(activeGroup.id)}>
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
          </View>
        </BottomSheetModal>

        <BottomSheetModal
          ref={createSheetRef}
          snapPoints={["85%", "100%"]}
          enableDynamicSizing={false}
          stackBehavior="push"
          keyboardBehavior="extend"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
          backdropComponent={(props) => (
            <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
          )}
        >
          <BottomSheetScrollView
            className="flex-1 px-4"
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text className="mb-3 text-lg font-semibold text-neutral-900">Akun Baru</Text>
            {createDefaultValues && (
              <AccountForm
                defaultValues={createDefaultValues}
                onSubmit={handleCreateSubmit}
                isPending={isCreating}
                submitLabel="Simpan & Pilih"
                hideKindToggle
                inBottomSheet
              />
            )}
          </BottomSheetScrollView>
        </BottomSheetModal>

        <BottomSheetModal
          ref={createGroupSheetRef}
          snapPoints={["40%", "70%"]}
          enableDynamicSizing={false}
          stackBehavior="push"
          keyboardBehavior="extend"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
          backdropComponent={(props) => (
            <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
          )}
        >
          <BottomSheetScrollView
            className="flex-1 px-4"
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text className="mb-3 text-lg font-semibold text-neutral-900">Grup Baru</Text>
            <AccountForm
              defaultValues={{ ...emptyAccountValues(), kind: "group" }}
              onSubmit={handleCreateGroupSubmit}
              isPending={isCreatingGroup}
              submitLabel="Simpan"
              hideKindToggle
              inBottomSheet
            />
          </BottomSheetScrollView>
        </BottomSheetModal>
      </>
    );
  }
);
