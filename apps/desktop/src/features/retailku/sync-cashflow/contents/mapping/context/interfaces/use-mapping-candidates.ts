import { useLoadMappingKeys } from "@/features/retailku/sync-cashflow/mapping/hooks/use-load-mapping-keys";
import { RetailkuCashflowSyncMode } from ".";

import { JSONContent } from "@tiptap/react";

// apps\desktop\src\features\retailku\sync-cashflow\contents\mapping\context\hooks\use-mapping-candidates.ts

export interface UseMappingCandidatesInput {
  loadKeys: ReturnType<typeof useLoadMappingKeys>;
  mode: RetailkuCashflowSyncMode;
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
