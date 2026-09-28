import { Dispatch, SetStateAction } from "react";
import { MappingRowDraft } from "./use-mapping-candidates";

export interface UseMappingDraftSaveInput {
  rows: MappingRowDraft[];
  drafts: Record<string, Partial<MappingRowDraft>>;
  setDrafts: Dispatch<SetStateAction<Record<string, Partial<MappingRowDraft>>>>;
}

export interface UseMappingDraftSaveOutput {
  isDirty: boolean;
  handleSave(): void;
  isSaving: boolean;
}
