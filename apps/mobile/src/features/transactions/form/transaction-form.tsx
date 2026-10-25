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
}

// Dipakai bareng oleh halaman create (app/transactions/new.tsx) dan
// edit (app/transactions/[id]/edit.tsx) — satu form, beda defaultValues/
// onSubmit dari pemanggil, sama seperti pola form/add-edit/ di desktop.
export function TransactionForm({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel,
}: TransactionFormProps) {
  return (
    <BaseForm
      schema={transactionSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      isPending={isPending}
      submitLabel={submitLabel}
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
