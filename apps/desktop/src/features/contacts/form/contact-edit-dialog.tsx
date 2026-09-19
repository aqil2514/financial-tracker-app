"use client";

import { Pencil } from "lucide-react";

import type { Contact } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/entity-form-dialog";
import { ContactForm } from "./contact-form";
import { useUpdateContact } from "./use-update-contact";

export function ContactEditDialog({ contact }: { contact: Contact }) {
  const { open, setOpen, form, onSubmit, isPending } = useUpdateContact(contact);

  return (
    <EntityFormDialog
      trigger={
        <Button variant="ghost" size="icon-sm">
          <Pencil className="size-4" />
        </Button>
      }
      title="Edit Kontak"
      open={open}
      onOpenChange={setOpen}
    >
      <ContactForm
        form={form}
        onSubmit={onSubmit}
        isPending={isPending}
        submitLabel="Simpan Perubahan"
      />
    </EntityFormDialog>
  );
}
