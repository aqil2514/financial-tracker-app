"use client";

import { useDbMutation } from "@/hooks/use-db-mutation";
import { dependentKeysOf } from "@/lib/query-dependencies";
import { createDirectThirdPartyFund } from "@/shared/third-party-funds";

type UseCreateThirdPartyFundOptions = {
  onCreated?: (transactionId: string) => void;
};

/**
 * Submit nyata untuk dialog "Catat Titip/Ambil Dana" — pola sama
 * `useCreateAccount` (dialog yang sudah punya `useForm` sendiri, hook ini
 * cuma urus mutation). Logic insert sesungguhnya ada di
 * `createDirectThirdPartyFund` (`shared/third-party-funds/`), diekstrak
 * supaya bisa dipanggil programatik di luar hook form juga (lihat
 * `shared/retailku/components/mapping-step/`).
 */
export function useCreateThirdPartyFund(options: UseCreateThirdPartyFundOptions = {}) {
  const { onCreated } = options;

  const mutation = useDbMutation({
    mutationFn: createDirectThirdPartyFund,
    invalidateKey: dependentKeysOf("transactions", "accounts"),
    successMessage: "Dana pihak ketiga berhasil dicatat",
    errorMessage: "Gagal mencatat dana pihak ketiga",
    onSuccess: (transactionId) => {
      onCreated?.(transactionId);
    },
  });

  return {
    onSubmit: mutation.mutate,
    isPending: mutation.isPending,
  };
}
