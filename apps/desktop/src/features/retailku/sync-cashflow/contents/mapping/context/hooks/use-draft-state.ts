import { useState } from "react";
import { MappingRowDraft, UseDraftStateOutput } from "../interfaces";

/**
 * State mentah `drafts` (perubahan belum tersimpan, per `key`) — DIPISAH
 * dari `use-mapping-candidates` (yang cuma DERIVE `rows`) dan dari
 * `use-mapping-draft-save` (yang cuma AKSI simpan), supaya `drafts`
 * punya satu sumber kebenaran yang dipakai ketiganya, sama pola
 * `use-filter-context` (state) vs `use-filter-context-load` (aksi).
 */
export function useDraftState(): UseDraftStateOutput {
  const [drafts, setDrafts] = useState<Record<string, Partial<MappingRowDraft>>>({});

  function updateDraft(key: string, patch: Partial<MappingRowDraft>) {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  return { drafts, setDrafts, updateDraft };
}
