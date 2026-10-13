"use client";

import { useEffect, type ReactNode } from "react";
import {
  useForm,
  FormProvider,
  type DefaultValues,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

interface BaseFormProps<TInput extends FieldValues, TOutput> {
  schema: ZodType<TOutput, TInput>;
  defaultValues: DefaultValues<TInput>;
  onSubmit: (values: TOutput) => void;
  isPending: boolean;
  submitLabel?: string;
  className?: string;
  children: (form: UseFormReturn<TInput, unknown, TOutput>) => ReactNode;
}

export function BaseForm<TInput extends FieldValues, TOutput>({
  schema,
  defaultValues,
  onSubmit,
  isPending,
  submitLabel = "Simpan",
  className = "space-y-4",
  children,
}: BaseFormProps<TInput, TOutput>) {
  const form = useForm<TInput, unknown, TOutput>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues]);

  return (
    <FormProvider {...form}>
      <form className={className} onSubmit={form.handleSubmit(onSubmit)}>
        {children(form)}
        <DialogFooter>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Menyimpan..." : submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}
