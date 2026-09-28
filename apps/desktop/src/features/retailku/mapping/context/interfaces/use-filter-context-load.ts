import { useLoadMappingKeys } from "../hooks/use-load-mapping-keys";
import { useLoadTransferMappingKeys } from "../hooks/use-load-transfer-mapping-keys";
import { UseFilterContextOutput } from "./use-filter-context";

export interface UseFilterContextLoadInput {
  filter: {
    mode: UseFilterContextOutput["mode"];
    dateFrom: UseFilterContextOutput["dateFrom"];
    dateTo: UseFilterContextOutput["dateTo"];
  };
  loadKeys: ReturnType<typeof useLoadMappingKeys>;
  /** Dimuat BERSAMAAN dgn `loadKeys` (1 tombol "Muat" yg sama, lihat
   * `header/filter.tsx`) — jalur transfer TIDAK punya filter mode
   * (summary/detail) sendiri, TIDAK terpengaruh `mode`. */
  loadTransferKeys: ReturnType<typeof useLoadTransferMappingKeys>;
}

export interface UseFilterContextLoadOutput {
  handleLoadKeys(): void;
  isLoadingKeys: boolean;
  loadKeysError: Error | null;
  hasLoadedKeys: boolean;
}
