import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BaseForm } from "@/components/forms/base-form";
import { FormFieldNumber, FormFieldSelect, FormFieldText } from "@/components/forms/form-fields";
import { transactionSchema, type TransactionFormOutput, type TransactionFormValues } from "./schema";

const TYPE_OPTIONS = [
  { value: "income", label: "Pemasukan" },
  { value: "expense", label: "Pengeluaran" },
  { value: "transfer", label: "Transfer" },
];

interface TransactionFormProps {
  defaultValues: TransactionFormValues;
  onSubmit: (values: TransactionFormOutput) => void;
  isPending: boolean;
  submitLabel?: string;
  onDelete?: () => void;
}

export function TransactionForm({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel,
  onDelete,
}: TransactionFormProps) {
  return (
    <BaseForm
      schema={transactionSchema}
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
          <FormFieldText form={form} name="note" label="Catatan" placeholder="Mis. Makan siang" />

          <FormFieldSelect
            form={form}
            name="type"
            label="Tipe Transaksi"
            options={TYPE_OPTIONS}
          />

          <FormFieldNumber form={form} name="amount" label="Jumlah" placeholder="0" />

          <FormFieldText form={form} name="account_id" label="Akun" placeholder="Mis. BCA, Cash" />

          {form.watch("type") === "transfer" ? (
            <FormFieldText
              form={form}
              name="transfer_account_id"
              label="Akun Tujuan"
              placeholder="Mis. Tabungan BRI"
            />
          ) : (
            <FormFieldText
              form={form}
              name="category_id"
              label="Kategori"
              placeholder="Mis. Makanan"
            />
          )}

          <FormFieldText form={form} name="date" label="Tanggal" placeholder="YYYY-MM-DD" />

          <FormFieldText
            form={form}
            name="description"
            label="Deskripsi (opsional)"
            placeholder="Catatan tambahan"
          />
        </>
      )}
    </BaseForm>
  );
}
