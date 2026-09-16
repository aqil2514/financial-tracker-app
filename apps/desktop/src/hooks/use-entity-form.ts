import { useEffect, useState } from "react";
import {
  useForm,
  type DefaultValues,
  type FieldValues,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { QueryKey } from "@tanstack/react-query";

import { useDbMutation } from "./use-db-mutation";

type UseEntityFormOptions<TInput extends FieldValues, TOutput> = {
  schema: Parameters<typeof zodResolver<TInput, unknown, TOutput>>[0];
  defaultValues: () => TInput;
  mutationFn: (values: TOutput) => Promise<unknown>;
  invalidateKey: QueryKey;
  successMessage: string;
  errorMessage: string;
  /** Re-derive defaultValues (e.g. from fresh entity data) whenever the dialog opens. */
  resetOnOpen?: boolean;
};

export function useEntityForm<TInput extends FieldValues, TOutput>({
  schema,
  defaultValues,
  mutationFn,
  invalidateKey,
  successMessage,
  errorMessage,
  resetOnOpen = false,
}: UseEntityFormOptions<TInput, TOutput>) {
  const [open, setOpen] = useState(false);

  const form = useForm<TInput, unknown, TOutput>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues() as DefaultValues<TInput>,
  });

  useEffect(() => {
    if (resetOnOpen && open) {
      form.reset(defaultValues() as DefaultValues<TInput>);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resetOnOpen]);

  const mutation = useDbMutation({
    mutationFn,
    invalidateKey,
    successMessage,
    errorMessage,
    onSuccess: () => {
      form.reset();
      setOpen(false);
    },
  });

  function onSubmit(values: TOutput) {
    mutation.mutate(values);
  }

  return { open, setOpen, form, onSubmit, isPending: mutation.isPending };
}
