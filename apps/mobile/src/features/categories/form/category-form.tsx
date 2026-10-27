import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BaseForm } from "@/components/forms/base-form";
import { FormFieldText, FormFieldToggleGroup } from "@/components/forms/form-fields";
import { categorySchema } from "./schema";
import { ParentCategoryField } from "./fields/parent-category";
import { CategoryFormProps } from "../types";

const TYPE_OPTIONS = [
  { value: "income", label: "Pemasukan" },
  { value: "expense", label: "Pengeluaran" },
];

export function CategoryForm({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel,
  excludeId,
  onDelete,
}: CategoryFormProps) {
  return (
    <BaseForm
      schema={categorySchema}
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
          <FormFieldToggleGroup
            form={form}
            name="type"
            label="Tipe"
            options={TYPE_OPTIONS}
          />

          <FormFieldText
            form={form}
            name="name"
            label="Nama"
            placeholder="Mis. 🍔 Makanan"
          />

          <ParentCategoryField excludeId={excludeId} />
        </>
      )}
    </BaseForm>
  );
}


