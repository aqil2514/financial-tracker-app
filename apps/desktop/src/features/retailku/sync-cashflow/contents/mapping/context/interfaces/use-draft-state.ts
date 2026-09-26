import { Dispatch, SetStateAction } from "react";
import { MappingRowDraft } from "./use-mapping-candidates";

export interface UseDraftStateOutput {
  drafts: Record<string, Partial<MappingRowDraft>>;
  setDrafts: Dispatch<SetStateAction<Record<string, Partial<MappingRowDraft>>>>;
  updateDraft(key: string, patch: Partial<MappingRowDraft>): void;
}
