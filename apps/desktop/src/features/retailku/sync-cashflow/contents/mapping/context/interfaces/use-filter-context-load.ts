import { useLoadMappingKeys } from "@/features/retailku/sync-cashflow/mapping/hooks/use-load-mapping-keys";
import { UseFilterContextOutput } from "./use-filter-context";

// apps\desktop\src\features\retailku\sync-cashflow\contents\mapping\context\hooks\use-filter-context-load.ts

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
