import { useEffect, useRef, useState } from "react";
import { useForm, type DefaultValues, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { QueryKey } from "@tanstack/react-query";

import { useDbMutation } from "./use-db-mutation";

type UseEntityFormOptions<
  TInput extends FieldValues,
  TOutput,
  TResult = unknown,
> = {
  schema: Parameters<typeof zodResolver<TInput, unknown, TOutput>>[0];
  defaultValues: () => TInput;
  mutationFn: (values: TOutput) => Promise<TResult>;
  invalidateKey: QueryKey | QueryKey[];
  successMessage: string;
  errorMessage: string;
  /** Re-derive defaultValues (e.g. from fresh entity data) whenever the dialog opens. */
  resetOnOpen?: boolean;
  /** Called with the mutation result before the form resets/closes. */
  onSuccess?: (result: TResult) => void | Promise<void>;
};

export function useEntityForm<
  TInput extends FieldValues,
  TOutput,
  TResult = unknown,
>({
  schema,
  defaultValues,
  mutationFn,
  invalidateKey,
  successMessage,
  errorMessage,
  resetOnOpen = false,
  onSuccess,
}: UseEntityFormOptions<TInput, TOutput, TResult>) {
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

  const keepOpenRef = useRef(false);

  const mutation = useDbMutation({
    mutationFn,
    invalidateKey,
    successMessage,
    errorMessage,
    onSuccess: async (result) => {
      await onSuccess?.(result);
      if (keepOpenRef.current) {
        form.reset(defaultValues() as DefaultValues<TInput>);
      } else {
        form.reset();
        setOpen(false);
      }
    },
  });

  function onSubmit(values: TOutput) {
    keepOpenRef.current = false;
    mutation.mutate(values);
  }

  function onSubmitAndContinue(values: TOutput) {
    keepOpenRef.current = true;
    mutation.mutate(values);
  }

  return {
    open,
    setOpen,
    form,
    onSubmit,
    onSubmitAndContinue,
    isPending: mutation.isPending,
  };
}
