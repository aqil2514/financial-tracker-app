import { useEffect, useRef, useState } from "react";
import { Controller, type Control, type FieldPath } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import { useDatabase } from "@/lib/database";
import {
  AccountPickerSheet,
  type AccountPickerSheetRef,
} from "@/features/accounts/content/account-picker-sheet";
import type { TransactionFormValues } from "../schema";

interface FormFieldAccountProps {
  control: Control<TransactionFormValues>;
  name: FieldPath<TransactionFormValues>;
  label: string;
  disabled?: boolean;
}

export function FormFieldAccount({ control, name, label, disabled }: FormFieldAccountProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <AccountFieldInput
          label={label}
          value={field.value as string | null}
          error={fieldState.error?.message}
          disabled={disabled}
          onChange={field.onChange}
        />
      )}
    />
  );
}

function AccountFieldInput({
  label,
  value,
  error,
  disabled,
  onChange,
}: {
  label: string;
  value: string | null;
  error?: string;
  disabled?: boolean;
  onChange: (accountId: string) => void;
}) {
  const db = useDatabase();
  const pickerRef = useRef<AccountPickerSheetRef>(null);
  const [fieldLabel, setFieldLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLabel() {
      if (!value) {
        if (!cancelled) setFieldLabel(null);
        return;
      }
      const row = await db.getFirstAsync<{ name: string }>(
        "SELECT name FROM accounts WHERE id = ?",
        [value]
      );
      if (!cancelled) setFieldLabel(row?.name ?? null);
    }

    loadLabel();
    return () => {
      cancelled = true;
    };
  }, [db, value]);

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-neutral-700">{label}</Text>
      <Pressable
        className="rounded-md border border-neutral-300 px-3 py-2 disabled:opacity-50"
        disabled={disabled}
        onPress={() => pickerRef.current?.present()}
      >
        <Text className={fieldLabel ? "text-neutral-900" : "text-neutral-400"}>
          {fieldLabel ?? "Pilih akun"}
        </Text>
      </Pressable>
      <AccountPickerSheet
        ref={pickerRef}
        onSelect={(account) => {
          onChange(account.id);
          setFieldLabel(account.name);
        }}
      />
      {error && <Text className="text-sm text-red-600">{error}</Text>}
    </View>
  );
}
