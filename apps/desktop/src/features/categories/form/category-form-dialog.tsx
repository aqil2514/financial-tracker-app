"use client";

import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/entity-form-dialog";
import { CategoryForm } from "./category-form";
import { useCreateCategory } from "./use-create-category";

export function CategoryFormDialog() {
  const { open, setOpen, form, onSubmit, isPending } = useCreateCategory();

  return (
    <EntityFormDialog
      trigger={<Button size="sm">Tambah Kategori</Button>}
      title="Tambah Kategori"
      open={open}
      onOpenChange={setOpen}
    >
      <CategoryForm form={form} onSubmit={onSubmit} isPending={isPending} />
    </EntityFormDialog>
  );
}
