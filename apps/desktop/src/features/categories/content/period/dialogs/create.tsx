"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { CategoryContentPeriodForm } from "../form";
import { useCreateCategoryPeriod } from "../hooks/use-create-category-period";
import { getCategoryPeriodDefaultValues } from "../form/schema";

export function CreateCategoryPeriodDialog() {
  const [open, setOpen] = useState(false);
  const mutation = useCreateCategoryPeriod({
    onCreated: () => setOpen(false),
  });

  return (
    <EntityFormDialog
      trigger={<Button size="sm">Tambah Periode</Button>}
      title="Tambah Periode"
      open={open}
      onOpenChange={setOpen}
    >
      <CategoryContentPeriodForm
        defaultValues={getCategoryPeriodDefaultValues("")}
        onSubmit={(values) => mutation.mutate(values)}
        isPending={mutation.isPending}
      />
    </EntityFormDialog>
  );
}
