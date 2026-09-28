import { UseFilterContextOutput } from "./use-filter-context";
import {
  UseFilterContextLoadInput,
  UseFilterContextLoadOutput,
} from "./use-filter-context-load";
import {
  GenericMappingRowDraft,
  TransferMappingRowDraft,
  ArApMappingRowDraft,
  MappingRowDraft,
  UseMappingCandidatesInput,
  UseMappingCandidatesOutput,
} from "./use-mapping-candidates";
import { UseDraftStateOutput, MappingRowDraftPatch } from "./use-draft-state";
import {
  UseMappingDraftSaveInput,
  UseMappingDraftSaveOutput,
} from "./use-mapping-draft-save";
import { UseResourcesOutput } from "./use-resources";

type RetailkuCashflowSyncMode = "summary" | "detail";

export type {
  RetailkuCashflowSyncMode,
  UseFilterContextOutput,

  //   Filter
  UseFilterContextLoadInput,
  UseFilterContextLoadOutput,

  //   Candidates
  GenericMappingRowDraft,
  TransferMappingRowDraft,
  ArApMappingRowDraft,
  MappingRowDraft,
  UseMappingCandidatesInput,
  UseMappingCandidatesOutput,

  //   Draft state
  UseDraftStateOutput,
  MappingRowDraftPatch,

  //   Draft save
  UseMappingDraftSaveInput,
  UseMappingDraftSaveOutput,

  //   Resources
  UseResourcesOutput,
};
