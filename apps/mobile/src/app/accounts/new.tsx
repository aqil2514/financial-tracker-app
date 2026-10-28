import { useState } from "react";
import { Stack, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { generateId, useDatabase } from "@/lib/database";
import { AccountForm } from "@/features/accounts/form/account-form";
import { emptyAccountValues } from "@/features/accounts/form/values";
import type { AccountFormOutput } from "@/features/accounts/form/schema";

export default function NewAccountPage() {
  const router = useRouter();
  const db = useDatabase();
  const [isPending, setIsPending] = useState(false);
  const [defaultValues] = useState(emptyAccountValues);

  async function handleSubmit(values: AccountFormOutput) {
    setIsPending(true);
    try {
      if (values.kind === "group") {
        await db.runAsync(`INSERT INTO account_groups (id, name) VALUES (?, ?)`, [
          generateId(),
          values.name,
        ]);
      } else {
        await db.runAsync(
          `INSERT INTO accounts (id, name, icon, color, group_id, initial_balance, description, is_active, account_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            generateId(),
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
      }

      router.back();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Tambah Akun" }} />
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerClassName="p-4 pb-12"
        bottomOffset={20}
      >
        <AccountForm
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isPending={isPending}
          submitLabel="Tambah"
        />
      </KeyboardAwareScrollView>
    </>
  );
}
