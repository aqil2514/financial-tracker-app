import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { CategoryForm } from "@/features/categories/content/list/form/category-form";
import { useTransactionFormFields } from "../../context/transaction-form-fields-context";

export function CreateCategoryDialog() {
  const { createCategory } = useTransactionFormFields();

  return (
    <EntityFormDialog
      title="Tambah Kategori Baru"
      open={createCategory.open}
      onOpenChange={createCategory.setOpen}
    >
      <CategoryForm
        form={createCategory.form}
        onSubmit={createCategory.onSubmit}
        isPending={createCategory.isPending}
      />
    </EntityFormDialog>
  );
}
