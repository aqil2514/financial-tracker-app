"use client";

import { useDbMutation } from "@/hooks/use-db-mutation";
import { dependentKeysOf } from "@/lib/query-dependencies";
import { createTransaction } from "@/features/transactions/form/add-edit/hooks/create-transaction";
import { createDirectThirdPartyFund } from "@/shared/third-party-funds";
import type { ThirdPartyFundFormOutput } from "@/features/third-party/content/data/form/schemas";
import type { TransactionFormOutput } from "@/features/transactions/form/add-edit/schema";
import type { RetailkuPackageEntry } from "../../registry/types";

export type SavePackageEntry = {
  entry: RetailkuPackageEntry;
  values: ThirdPartyFundFormOutput | TransactionFormOutput;
};

export function useSavePackage(onDone?: () => void) {
  return useDbMutation({
    mutationFn: async (entries: SavePackageEntry[]) => {
      for (const { entry, values } of entries) {
        if (entry.target === "transaction") {
          await createTransaction(values as TransactionFormOutput);
        } else {
          await createDirectThirdPartyFund(values as ThirdPartyFundFormOutput);
        }
      }
    },
    invalidateKey: dependentKeysOf("transactions"),
    successMessage: "Semua data berhasil disimpan",
    errorMessage: "Gagal menyimpan data",
    onSuccess: () => {
      onDone?.();
    },
  });
}
