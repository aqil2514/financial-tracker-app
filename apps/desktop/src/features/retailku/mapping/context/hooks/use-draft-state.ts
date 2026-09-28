import { useState } from "react";
import { MappingRowDraft, UseDraftStateOutput } from "../interfaces";

export function useDraftState(): UseDraftStateOutput {
  const [drafts, setDrafts] = useState<Record<string, Partial<MappingRowDraft>>>({});

  function updateDraft(key: string, patch: Partial<MappingRowDraft>) {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  return { drafts, setDrafts, updateDraft };
}
