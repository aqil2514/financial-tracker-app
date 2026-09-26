import { useLoadMappingKeys } from "../hooks/use-load-mapping-keys";
import { UseFilterContextOutput } from "./use-filter-context";

export interface UseFilterContextLoadInput {
  filter: {
    mode: UseFilterContextOutput["mode"];
    dateFrom: UseFilterContextOutput["dateFrom"];
    dateTo: UseFilterContextOutput["dateTo"];
  };
  loadKeys: ReturnType<typeof useLoadMappingKeys>;
}

export interface UseFilterContextLoadOutput {
  handleLoadKeys(): void;
  isLoadingKeys: boolean;
  loadKeysError: Error | null;
  hasLoadedKeys: boolean;
}
