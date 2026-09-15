import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";

type UseDbMutationOptions<TInput, TResult> = {
  mutationFn: (values: TInput) => Promise<TResult>;
  invalidateKey: QueryKey;
  successMessage: string;
  errorMessage: string;
  onSuccess?: (result: TResult) => void;
};

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
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      toast.success(successMessage);
      onSuccess?.(result);
    },
    onError: (err) => {
      toast.error(`${errorMessage}: ${(err as Error).message}`);
    },
  });
}
