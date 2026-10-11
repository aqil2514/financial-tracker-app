import { useEffect, useRef } from "react";
import { useForm, type DefaultValues, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { QueryKey } from "@tanstack/react-query";

import { useDbMutation } from "@/hooks/use-db-mutation";

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
  open: boolean;
  resetOnOpen?: boolean;
  onSuccess?: (result: TResult, info: { keepOpen: boolean }) => void | Promise<void>;
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
  open,
  resetOnOpen = false,
  onSuccess,
}: UseEntityFormOptions<TInput, TOutput, TResult>) {
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
      const keepOpen = keepOpenRef.current;
      await onSuccess?.(result, { keepOpen });
      if (keepOpen) {
        form.reset(defaultValues() as DefaultValues<TInput>);
      } else {
        form.reset();
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
    form,
    onSubmit,
    onSubmitAndContinue,
    isPending: mutation.isPending,
  };
}
