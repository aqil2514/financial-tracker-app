"use client";

import type { ReactNode } from "react";
import { FormProvider, type UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import type { TransactionFormOutput, TransactionFormValues } from "../schema";

interface TransactionBaseFormProps {
  form: UseFormReturn<TransactionFormValues, unknown, TransactionFormOutput>;
  onSubmit: (values: TransactionFormOutput) => void;
  isPending: boolean;
  submitLabel?: string;
  className?: string;
  children: ReactNode;
}

/** `TransactionForm` butuh `form` yang SUDAH jadi dari luar
 * (`useCreateTransaction`/`useUpdateTransaction`, masih pakai
 * `useEntityForm`) — tidak seperti `@/components/forms/base-form.tsx`
 * yang membuat `useForm`-nya sendiri. Wrapper ini khusus menampung
 * kasus itu, bukan generalisasi `BaseForm` bersama. */
export function TransactionBaseForm({
  form,
  onSubmit,
  isPending,
  submitLabel = "Simpan",
  className,
  children,
}: TransactionBaseFormProps) {
  return (
    <FormProvider {...form}>
      <form className={className} onSubmit={form.handleSubmit(onSubmit)}>
        {children}
        <DialogFooter className="mt-6">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Menyimpan..." : submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}
