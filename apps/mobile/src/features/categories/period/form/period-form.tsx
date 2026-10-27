import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BaseForm } from "@/components/forms/base-form";
import { FormFieldDate, FormFieldText } from "@/components/forms/form-fields";
import { categoryPeriodSchema } from "./schema";
import { CategoryMultiSelectField } from "./fields/category-multi-select";
import type { CategoryPeriodFormProps } from "../types";

export function CategoryPeriodForm({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel,
  onDelete,
}: CategoryPeriodFormProps) {
  return (
    <BaseForm
      schema={categoryPeriodSchema}
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
          <FormFieldText form={form} name="name" label="Nama Periode" placeholder="Mis. Panen 2026" />

          <CategoryMultiSelectField />

          <FormFieldDate form={form} name="start_date" label="Tanggal Mulai" />

          <FormFieldDate form={form} name="end_date" label="Tanggal Selesai" />
        </>
      )}
    </BaseForm>
  );
}
