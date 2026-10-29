import { forwardRef, useImperativeHandle } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { BaseForm } from "@/components/forms/base-form";
import {
  FormFieldDate,
  FormFieldNumber,
  FormFieldText,
  FormFieldToggleGroup,
} from "@/components/forms/form-fields";
import { transactionSchema, type TransactionFormOutput, type TransactionFormValues } from "./schema";
import { FormFieldCategory } from "./fields/form-field-category";
import { FormFieldAccount } from "./fields/form-field-account";
import { FormFieldContact } from "./fields/form-field-contact";
import { FieldDebtAction } from "./fields/field-debt-action";
import { useTransactionDebtFields } from "./use-transaction-debt-fields";

const TYPE_OPTIONS = [
  { value: "income", label: "Pemasukan" },
  { value: "expense", label: "Pengeluaran" },
  { value: "transfer", label: "Transfer" },
];

export interface TransactionFormRef {
  // Validasi tambahan yang butuh query async (ongoingDebts) sehingga
  // tidak bisa masuk ke pipeline zod biasa — panggil ini SEBELUM insert
  // di handler submit pemanggil, batalkan kalau hasilnya bukan null.
  validateDebtFields: (values: TransactionFormOutput) => string | null;
}

interface TransactionFormProps {
  defaultValues: TransactionFormValues;
  onSubmit: (values: TransactionFormOutput) => void;
  isPending: boolean;
  submitLabel?: string;
  onDelete?: () => void;
}

export const TransactionForm = forwardRef<TransactionFormRef, TransactionFormProps>(
  function TransactionForm({ defaultValues, onSubmit, isPending, submitLabel, onDelete }, ref) {
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
        {(form) => <TransactionFormFields form={form} formRef={ref} />}
      </BaseForm>
    );
  }
);

function TransactionFormFields({
  form,
  formRef,
}: {
  form: UseFormReturn<TransactionFormValues, unknown, TransactionFormOutput>;
  formRef: React.Ref<TransactionFormRef>;
}) {
  const type = useWatch({ control: form.control, name: "type" });
  const accountId = useWatch({ control: form.control, name: "account_id" });
  const transferAccountId = useWatch({ control: form.control, name: "transfer_account_id" });
  const contactId = useWatch({ control: form.control, name: "contact_id" });

  const { involvesDebtAccount, needsDebtAction, settlementDirection, ongoingDebts, validateDebtFields } =
    useTransactionDebtFields({ type, accountId, transferAccountId, contactId });

  useImperativeHandle(formRef, () => ({ validateDebtFields }), [validateDebtFields]);

  return (
    <>
      <FormFieldToggleGroup form={form} name="type" options={TYPE_OPTIONS} />

      <FormFieldText form={form} name="note" label="Catatan" placeholder="Mis. Makan siang" />

      <FormFieldNumber
        form={form}
        name="amount"
        label="Jumlah"
        placeholder="0"
        prefix="Rp"
        grouped
        useCalculator
      />

      <FormFieldAccount control={form.control} name="account_id" label="Akun" />

      {type === "transfer" ? (
        <FormFieldAccount control={form.control} name="transfer_account_id" label="Akun Tujuan" />
      ) : (
        <FormFieldCategory control={form.control} type={type as "income" | "expense"} />
      )}

      {involvesDebtAccount && <FormFieldContact control={form.control} />}

      {needsDebtAction && settlementDirection && (
        <FieldDebtAction control={form.control} ongoingDebts={ongoingDebts} direction={settlementDirection} />
      )}

      <FormFieldDate form={form} name="date" label="Tanggal" />

      <FormFieldText
        form={form}
        name="description"
        label="Deskripsi (opsional)"
        placeholder="Catatan tambahan"
        multiline
      />
    </>
  );
}
