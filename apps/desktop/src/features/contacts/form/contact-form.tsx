"use client";

import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { FormFieldText, FormFieldRichText } from "@/components/forms/form-fields";
import type { ContactFormOutput, ContactFormValues } from "./contact.schema";

type ContactFormProps = {
  form: UseFormReturn<ContactFormValues, unknown, ContactFormOutput>;
  onSubmit: (values: ContactFormOutput) => void;
  isPending: boolean;
  submitLabel?: string;
};

export function ContactForm({
  form,
  onSubmit,
  isPending,
  submitLabel = "Simpan",
}: ContactFormProps) {
  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <FormFieldText form={form} name="name" label="Nama" placeholder="Contoh: Endi" />
      <FormFieldRichText form={form} name="note" label="Catatan" />
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
