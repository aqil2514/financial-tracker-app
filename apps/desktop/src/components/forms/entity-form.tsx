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
  children: ReactNode;
  extraActions?: ReactNode;
  className?: string;
}

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
