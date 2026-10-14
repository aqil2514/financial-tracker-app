import { FormFieldToggleGroup } from "@/components/forms/form-fields";
import { useTransactionFormFields } from "../../context/transaction-form-fields-context";

const typeOptions = [
  { value: "income", label: "Pemasukan" },
  { value: "expense", label: "Pengeluaran" },
  { value: "transfer", label: "Transfer" },
];

export function FieldTransactionType() {
  const { form, debtFieldsLocked } = useTransactionFormFields();

  return (
    <FormFieldToggleGroup
      form={form}
      name="type"
      label="Tipe Transaksi"
      options={typeOptions}
      disabled={debtFieldsLocked}
    />
  );
}
