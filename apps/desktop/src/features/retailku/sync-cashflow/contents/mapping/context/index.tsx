import { createContext, useContext } from "react";
import { UseMappingCandidatesOutput, UseResourcesOutput } from "./interfaces";
import {
  useFilterContext,
  useFilterContextLoad,
  useLoadMappingKeys,
  useMappingCandidates,
  useResources,
} from "./hooks";
import {
  UseFilterContextOutput,
  UseFilterContextLoadOutput,
} from "./interfaces";

interface RetailkuSyncCashflowMappingContextType {
  filter: UseFilterContextOutput;
  loads: UseFilterContextLoadOutput;
  candidates: UseMappingCandidatesOutput;
  resources: UseResourcesOutput;
}

const RetailkuSyncCashflowMappingContext =
  createContext<RetailkuSyncCashflowMappingContextType>(
    {} as RetailkuSyncCashflowMappingContextType,
  );

interface Props {
  children: React.ReactNode;
}

export function RetailkuSyncCashflowMappingProvider({ children }: Props) {
  const filter = useFilterContext();
  const resources = useResources();
  const loadKeys = useLoadMappingKeys();
  const loads = useFilterContextLoad({ filter, loadKeys });
  const candidates = useMappingCandidates({ loadKeys, mode: filter.mode });

  const values: RetailkuSyncCashflowMappingContextType = {
    filter,
    loads,
    candidates,
    resources,
  };

  return (
    <RetailkuSyncCashflowMappingContext.Provider value={values}>
      {children}
    </RetailkuSyncCashflowMappingContext.Provider>
  );
}

export const useRetailkuSyncCashflowMapping = () =>
  useContext(RetailkuSyncCashflowMappingContext);
