import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BaseForm } from "@/components/forms/base-form";
import { FormFieldText, FormFieldToggleGroup } from "@/components/forms/form-fields";
import { SCOPE_OPTIONS } from "../scope-options";
import { labelSchema } from "./schema";
import type { LabelFormProps } from "../types";

export function LabelForm({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel,
  onDelete,
  lockScope,
  error,
}: LabelFormProps) {
  return (
    <BaseForm
      schema={labelSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      isPending={isPending}
      submitLabel={submitLabel}
      renderFooter={
        onDelete
          ? (submit) => (
              <View className="flex-row items-center justify-end gap-2 border-t border-neutral-200 pt-3">
                <Pressable
                  className="flex-row items-center gap-1.5 rounded-md border border-red-200 px-4 py-3"
                  onPress={onDelete}
                >
                  <Ionicons name="trash-outline" size={18} color="#dc2626" />
                  <Text className="font-medium text-red-600">Hapus</Text>
                </Pressable>
                <Pressable
                  className="flex-row items-center gap-1.5 rounded-md bg-neutral-900 px-4 py-3 disabled:opacity-50"
                  disabled={isPending}
                  onPress={submit}
                >
                  <Ionicons name="checkmark-outline" size={18} color="white" />
                  <Text className="font-medium text-white">
                    {isPending ? "Menyimpan..." : (submitLabel ?? "Simpan")}
                  </Text>
                </Pressable>
              </View>
            )
          : undefined
      }
    >
      {(form) => (
        <>
          <FormFieldText form={form} name="name" label="Nama" placeholder="Mis. Liburan" />
          <FormFieldToggleGroup
            form={form}
            name="scope"
            label="Berlaku untuk"
            options={SCOPE_OPTIONS}
            disabled={lockScope}
          />
          {error && <Text className="text-sm text-red-600">{error}</Text>}
        </>
      )}
    </BaseForm>
  );
}
