import { useRetailkuSettings } from "@/shared/retailku";
import { UseFilterContextLoadInput } from "../interfaces";
import { UseFilterContextLoadOutput } from "../interfaces";

export function useFilterContextLoad(
  params: UseFilterContextLoadInput,
): UseFilterContextLoadOutput {
  const { dateFrom, dateTo, mode } = params.filter;
  const { loadKeys, loadTransferKeys } = params;
  const { data: retailkuSettings } = useRetailkuSettings();

  const handleLoadKeys = () => {
    loadKeys.mutate({ retailkuSettings, mode, dateFrom, dateTo });
    loadTransferKeys.mutate({ retailkuSettings, dateFrom, dateTo });
  };

  return {
    handleLoadKeys,
    isLoadingKeys: loadKeys.isPending || loadTransferKeys.isPending,
    loadKeysError: loadKeys.error,
    hasLoadedKeys: loadKeys.isSuccess,
  };
}
