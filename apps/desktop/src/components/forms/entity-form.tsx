"use client";

import type { ReactNode } from "react";
import { FormProvider, type FieldValues, type UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

interface EntityFormProps<TInput extends FieldValues, TOutput> {
  form: UseFormReturn<TInput, unknown, TOutput>;
  onSubmit: (values: TOutput) => void;
  isPending: boolean;
  submitLabel?: string;
  /** Field-field spesifik fitur — terima `form` sebagai prop (pola
   * `@/components/forms/form-fields` saat ini), ATAU untuk sub-komponen
   * yang bersarang dalam, ambil lewat `useFormContext()` (disediakan oleh
   * `FormProvider` di bawah) supaya tidak perlu meneruskan `form`/`control`
   * manual di tiap level. */
  children: ReactNode;
  /** Tombol tambahan di footer, sejajar sebelum tombol submit (mis.
   * "Lanjut" pada TransactionForm). */
  extraActions?: ReactNode;
  className?: string;
}

/**
 * Pembungkus <form>+submit button generic — menyatukan pola yang
 * sebelumnya diulang manual di tiap *-form.tsx (ContactForm, AccountForm,
 * AccountGroupForm, dst): `<form onSubmit={form.handleSubmit(onSubmit)}>`
 * + `DialogFooter` + tombol submit dengan label "Menyimpan...". Field
 * spesifik fitur tetap ditulis manual sebagai children — komponen ini
 * TIDAK tahu domain apa pun, cuma schema/output generic dari `form`.
 */
export function EntityForm<TInput extends FieldValues, TOutput>({
  form,
  onSubmit,
  isPending,
  submitLabel = "Simpan",
  children,
  extraActions,
  className = "space-y-4",
}: EntityFormProps<TInput, TOutput>) {
  return (
    <FormProvider {...form}>
      <form className={className} onSubmit={form.handleSubmit(onSubmit)}>
        {children}
        <DialogFooter>
          {extraActions}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Menyimpan..." : submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}
