import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDatabase } from "@/lib/database";
import { AccountForm } from "@/features/accounts/form/account-form";
import { emptyAccountValues } from "@/features/accounts/form/values";
import type { AccountFormOutput, AccountFormValues } from "@/features/accounts/form/schema";

export default function EditAccountGroupPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();
  const [defaultValues, setDefaultValues] = useState<AccountFormValues | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    db.getFirstAsync<{ name: string }>("SELECT name FROM account_groups WHERE id = ?", [id]).then(
      (row) => {
        if (row) setDefaultValues({ ...emptyAccountValues(), kind: "group", name: row.name });
      }
    );
  }, [db, id]);

  async function handleSubmit(values: AccountFormOutput) {
    setIsPending(true);
    try {
      await db.runAsync("UPDATE account_groups SET name = ? WHERE id = ?", [values.name, id]);
      router.back();
    } finally {
      setIsPending(false);
    }
  }

  async function deleteGroup() {
    await db.runAsync("DELETE FROM account_groups WHERE id = ?", [id]);
    router.back();
  }

  async function handleDelete() {
    const row = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM accounts WHERE group_id = ?",
      [id]
    );
    const usageCount = row?.count ?? 0;

    Alert.alert(
      "Hapus grup ini?",
      usageCount > 0
        ? `${usageCount} akun di grup ini akan jadi "Tanpa Grup". Tindakan ini tidak bisa dibatalkan.`
        : "Tindakan ini tidak bisa dibatalkan.",
      [
        { text: "Batal", style: "cancel" },
        { text: "Hapus", style: "destructive", onPress: deleteGroup },
      ]
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Edit Grup Akun" }} />
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerClassName="p-4 pb-12"
        bottomOffset={20}
      >
        {defaultValues && (
          <AccountForm
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            isPending={isPending}
            submitLabel="Simpan Perubahan"
            hideKindToggle
            onDelete={handleDelete}
          />
        )}
      </KeyboardAwareScrollView>
    </>
  );
}
