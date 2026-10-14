import { LabelField } from "@/shared/labels/label-field";
import { useTransactionFormFields } from "../../context/transaction-form-fields-context";

export function FieldLabel() {
  const { form } = useTransactionFormFields();

  return <LabelField control={form.control} scope="transaction_category" label="Label" />;
}
