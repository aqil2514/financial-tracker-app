import { useLoadMappingKeys } from "../hooks/use-load-mapping-keys";
import { useLoadTransferMappingKeys } from "../hooks/use-load-transfer-mapping-keys";
import { useLoadArApMappingKeys } from "../hooks/use-load-ar-ap-mapping-keys";
import { RetailkuCashflowSyncMode } from ".";
import type { MappingRowDraftPatch } from "./use-draft-state";

import { JSONContent } from "@tiptap/react";

export interface UseMappingCandidatesInput {
  loadKeys: ReturnType<typeof useLoadMappingKeys>;
  loadTransferKeys: ReturnType<typeof useLoadTransferMappingKeys>;
  loadArApKeys: ReturnType<typeof useLoadArApMappingKeys>;
  mode: RetailkuCashflowSyncMode;
  drafts: Record<string, MappingRowDraftPatch>;
}

export interface UseMappingCandidatesOutput {
  rows: MappingRowDraft[];
}

export interface GenericMappingRowDraft {
  key: string;
  sourceType: "generic";
  retailkuAccountId: string;
  retailkuAccountCode: string;
  accountName: string;
  localAccountId: string | null;
  note: string;
  categoryId: string | null;
  description: JSONContent | null;
  noteFollowSource: boolean;
  descriptionFollowSource: boolean;
}

export interface TransferMappingRowDraft {
  key: string;
  sourceType: "FUND_TRANSFER";
  fromAccountName: string;
  toAccountName: string;
  transactionCount: number;
  localAccountId: string | null;
  secondaryAccountId: string | null;
  note: string;
  categoryId: string | null;
  description: JSONContent | null;
  noteFollowSource: boolean;
  descriptionFollowSource: boolean;
}

export interface ArApMappingRowDraft {
  key: string;
  sourceType: "AR_AP";
  accountName: string;
  direction: "receivable" | "payable";
  kind: "trade" | "non-trade" | null;
  transactionCount: number;
  partyNames: string[];
  localAccountId: string | null;
  contactId: string | null;
  contactFollowSource: boolean;
  note: string;
  description: JSONContent | null;
}

export type MappingRowDraft = GenericMappingRowDraft | TransferMappingRowDraft | ArApMappingRowDraft;
