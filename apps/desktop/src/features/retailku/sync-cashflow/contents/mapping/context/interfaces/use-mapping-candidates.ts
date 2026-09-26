import { useLoadMappingKeys } from "../hooks/use-load-mapping-keys";
import { RetailkuCashflowSyncMode } from ".";

import { JSONContent } from "@tiptap/react";

export interface UseMappingCandidatesInput {
  loadKeys: ReturnType<typeof useLoadMappingKeys>;
  mode: RetailkuCashflowSyncMode;
  drafts: Record<string, Partial<MappingRowDraft>>;
}

export interface UseMappingCandidatesOutput {
  rows: MappingRowDraft[];
}

export interface MappingRowDraft {
  key: string;
  retailkuAccountId: string;
  retailkuAccountCode: string;
  accountName: string;
  localAccountId: number | null;
  note: string;
  categoryId: number | null;
  description: JSONContent | null; //Buat render deskripsi (Dari tiptap Rich Text Editor)
}
