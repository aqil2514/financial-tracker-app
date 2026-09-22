"use client";

import { Pencil } from "lucide-react";

import type { Category } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { CategoryForm } from "./category-form";
import { useUpdateCategory } from "./use-update-category";

export function CategoryEditDialog({ category }: { category: Category }) {
  const { open, setOpen, form, onSubmit, isPending } =
    useUpdateCategory(category);

  return (
    <EntityFormDialog
      trigger={
        <Button variant="ghost" size="icon-sm">
          <Pencil className="size-4" />
        </Button>
      }
      title="Edit Kategori"
      open={open}
      onOpenChange={setOpen}
    >
      <CategoryForm
        form={form}
        onSubmit={onSubmit}
        isPending={isPending}
        submitLabel="Simpan Perubahan"
        excludeId={category.id}
      />
    </EntityFormDialog>
  );
}
