"use client";

import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import type { LabelWithUsage } from "@/shared/labels/use-label-list";
import { LabelForm } from "./label-form";
import { useUpdateLabel } from "./use-update-label";

export function LabelEditDialog({ label }: { label: LabelWithUsage }) {
  const { open, setOpen, form, onSubmit, isPending } = useUpdateLabel(label);

  return (
    <EntityFormDialog
      trigger={
        <Button variant="ghost" size="icon-sm">
          <Pencil className="size-4" />
        </Button>
      }
      title="Edit Label"
      open={open}
      onOpenChange={setOpen}
    >
      <LabelForm form={form} onSubmit={onSubmit} isPending={isPending} submitLabel="Simpan Perubahan" lockScope />
    </EntityFormDialog>
  );
}
