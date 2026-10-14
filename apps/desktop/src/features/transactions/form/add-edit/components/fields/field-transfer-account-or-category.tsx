import { FormFieldCombobox } from "@/components/forms/form-fields";
import { useTransactionFormFields } from "../../context/transaction-form-fields-context";

export function FieldTransferAccountOrCategory() {
  const {
    form,
    type,
    debtFieldsLocked,
    accountOptions,
    categoryOptions,
    renderAccountOption,
    openCreateAccount,
    openCreateCategory,
  } = useTransactionFormFields();

  if (type === "transfer") {
    return (
      <FormFieldCombobox
        form={form}
        name="transfer_account_id"
        label="Ke Akun"
        placeholder="Cari akun tujuan..."
        options={accountOptions}
        disabled={debtFieldsLocked}
        renderOption={renderAccountOption}
        onCreateNew={
          debtFieldsLocked
            ? undefined
            : (query) => openCreateAccount("transfer_account_id", query)
        }
      />
    );
  }

  return (
    <FormFieldCombobox
      form={form}
      name="category_id"
      label="Kategori"
      placeholder="Cari kategori..."
      options={categoryOptions}
      allowClear
      onCreateNew={openCreateCategory}
    />
  );
}
