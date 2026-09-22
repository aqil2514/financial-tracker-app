"use client";

import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { ContactForm } from "./contact-form";
import { useCreateContact } from "./use-create-contact";

export function ContactFormDialog() {
  const { open, setOpen, form, onSubmit, isPending } = useCreateContact();

  return (
    <EntityFormDialog
      trigger={<Button size="sm">Tambah Kontak</Button>}
      title="Tambah Kontak"
      open={open}
      onOpenChange={setOpen}
    >
      <ContactForm form={form} onSubmit={onSubmit} isPending={isPending} />
    </EntityFormDialog>
  );
}
