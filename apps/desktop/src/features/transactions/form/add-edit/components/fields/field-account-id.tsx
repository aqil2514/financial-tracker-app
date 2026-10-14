import { FormFieldCombobox } from "@/components/forms/form-fields";
import { useTransactionFormFields } from "../../context/transaction-form-fields-context";

export function FieldAccountId() {
  const { form, type, debtFieldsLocked, accountOptions, renderAccountOption, openCreateAccount } =
    useTransactionFormFields();

  return (
    <FormFieldCombobox
      form={form}
      name="account_id"
      label={type === "transfer" ? "Dari Akun" : "Akun"}
      placeholder="Cari akun..."
      options={accountOptions}
      disabled={debtFieldsLocked}
      renderOption={renderAccountOption}
      onCreateNew={
        debtFieldsLocked ? undefined : (query) => openCreateAccount("account_id", query)
      }
    />
  );
}
