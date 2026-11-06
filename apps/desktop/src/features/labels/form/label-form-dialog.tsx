"use client";

import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { LabelForm } from "./label-form";
import { useCreateLabel } from "./use-create-label";

export function LabelFormDialog() {
  const { open, setOpen, form, onSubmit, isPending } = useCreateLabel();

  return (
    <EntityFormDialog
      trigger={<Button size="sm">Tambah Label</Button>}
      title="Tambah Label"
      open={open}
      onOpenChange={setOpen}
    >
      <LabelForm form={form} onSubmit={onSubmit} isPending={isPending} />
    </EntityFormDialog>
  );
}
