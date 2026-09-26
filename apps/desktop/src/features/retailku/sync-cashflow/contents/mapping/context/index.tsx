import { createContext, useContext } from "react";
import {
  UseDraftStateOutput,
  UseMappingCandidatesOutput,
  UseMappingDraftSaveOutput,
  UseResourcesOutput,
} from "./interfaces";
import {
  useDraftState,
  useFilterContext,
  useFilterContextLoad,
  useLoadMappingKeys,
  useMappingCandidates,
  useMappingDraftSave,
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
  draftState: UseDraftStateOutput;
  save: UseMappingDraftSaveOutput;
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
  const draftState = useDraftState();
  const candidates = useMappingCandidates({
    loadKeys,
    mode: filter.mode,
    drafts: draftState.drafts,
  });
  const save = useMappingDraftSave({
    rows: candidates.rows,
    drafts: draftState.drafts,
    setDrafts: draftState.setDrafts,
  });

  const values: RetailkuSyncCashflowMappingContextType = {
    filter,
    loads,
    candidates,
    draftState,
    save,
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
