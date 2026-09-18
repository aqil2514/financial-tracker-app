import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";

type UseDbMutationOptions<TInput, TResult> = {
  mutationFn: (values: TInput) => Promise<TResult>;
  invalidateKey: QueryKey | QueryKey[];
  successMessage: string;
  errorMessage: string;
  onSuccess?: (result: TResult) => void | Promise<void>;
};

function isQueryKeyList(key: QueryKey | QueryKey[]): key is QueryKey[] {
  return Array.isArray(key) && key.every((k) => Array.isArray(k));
}

export function useDbMutation<TInput, TResult = void>({
  mutationFn,
  invalidateKey,
  successMessage,
  errorMessage,
  onSuccess,
}: UseDbMutationOptions<TInput, TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async (result) => {
      const keys = isQueryKeyList(invalidateKey)
        ? invalidateKey
        : [invalidateKey];
      keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      await onSuccess?.(result);
      toast.success(successMessage);
    },
    onError: (err) => {
      const detail = err instanceof Error ? err.message : String(err);
      toast.error(`${errorMessage}: ${detail}`);
    },
  });
}
