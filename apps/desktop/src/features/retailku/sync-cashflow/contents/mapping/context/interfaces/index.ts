import { UseFilterContextOutput } from "./use-filter-context";
import {
  UseFilterContextLoadInput,
  UseFilterContextLoadOutput,
} from "./use-filter-context-load";
import {
  MappingRowDraft,
  UseMappingCandidatesInput,
  UseMappingCandidatesOutput,
} from "./use-mapping-candidates";
import { UseDraftStateOutput } from "./use-draft-state";
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
  MappingRowDraft,
  UseMappingCandidatesInput,
  UseMappingCandidatesOutput,

  //   Draft state
  UseDraftStateOutput,

  //   Draft save
  UseMappingDraftSaveInput,
  UseMappingDraftSaveOutput,

  //   Resources
  UseResourcesOutput,
};
