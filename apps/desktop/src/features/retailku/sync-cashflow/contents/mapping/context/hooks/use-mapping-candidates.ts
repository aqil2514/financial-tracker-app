import { useMemo } from "react";
import {
  GenericMappingRowDraft,
  MappingRowDraft,
  TransferMappingRowDraft,
  UseMappingCandidatesInput,
  UseMappingCandidatesOutput,
} from "../interfaces";
import { FieldMapping, useFieldMapping } from "@/shared/retailku";
import {
  MappingKeyCandidate,
} from "./use-load-mapping-keys";
import { TransferMappingKeyCandidate } from "./use-load-transfer-mapping-keys";
import { JSONContent } from "@tiptap/react";

export function useMappingCandidates({
  loadKeys,
  loadTransferKeys,
  mode,
  drafts,
}: UseMappingCandidatesInput): UseMappingCandidatesOutput {
  const { data: savedMapping } = useFieldMapping();

  const savedByKey = useMemo(() => {
    const map = new Map<string, FieldMapping>();
    for (const row of savedMapping ?? []) map.set(row.key, row);
    return map;
  }, [savedMapping]);

  const genericRows: GenericMappingRowDraft[] = useMemo(() => {
    const candidates: MappingKeyCandidate[] = loadKeys.data ?? [];
    const byKey = new Map<string, GenericMappingRowDraft>();

    for (const candidate of candidates) {
      const saved = savedByKey.get(candidate.key);
      byKey.set(candidate.key, {
        key: candidate.key,
        sourceType: "generic",
        retailkuAccountId: candidate.retailkuAccountId,
        retailkuAccountCode: candidate.retailkuAccountCode,
        accountName: candidate.accountName,
        localAccountId: saved?.localAccountId ?? null,
        note: saved?.note ?? "",
        categoryId: saved?.categoryId ?? null,
        description: parseDescription(saved?.description ?? null),
        noteFollowSource: saved?.extraFields.noteFollowSource ?? false,
        descriptionFollowSource: saved?.extraFields.descriptionFollowSource ?? false,
      });
    }

    for (const saved of savedMapping ?? []) {
      if (byKey.has(saved.key)) continue;
      if (!saved.key.startsWith(`${mode}:`)) continue;
      byKey.set(saved.key, {
        key: saved.key,
        sourceType: "generic",
        retailkuAccountId: saved.retailkuAccountId,
        retailkuAccountCode: saved.retailkuAccountCode,
        accountName: saved.retailkuAccountName,
        localAccountId: saved.localAccountId,
        note: saved.note ?? "",
        categoryId: saved.categoryId,
        description: parseDescription(saved.description),
        noteFollowSource: saved.extraFields.noteFollowSource ?? false,
        descriptionFollowSource: saved.extraFields.descriptionFollowSource ?? false,
      });
    }

    return [...byKey.values()].map((row) => ({
      ...row,
      ...(drafts[row.key] as Partial<GenericMappingRowDraft> | undefined),
    }));
  }, [loadKeys.data, savedByKey, savedMapping, drafts, mode]);

  const transferRows: TransferMappingRowDraft[] = useMemo(() => {
    const candidates: TransferMappingKeyCandidate[] = loadTransferKeys.data ?? [];
    const byKey = new Map<string, TransferMappingRowDraft>();

    for (const candidate of candidates) {
      const saved = savedByKey.get(candidate.key);
      byKey.set(candidate.key, {
        key: candidate.key,
        sourceType: "FUND_TRANSFER",
        fromAccountName: candidate.fromAccountName,
        toAccountName: candidate.toAccountName,
        transactionCount: candidate.transactionCount,
        localAccountId: saved?.localAccountId ?? null,
        secondaryAccountId: saved?.secondaryAccountId ?? null,
        note: saved?.note ?? "",
        categoryId: saved?.categoryId ?? null,
        description: parseDescription(saved?.description ?? null),
        noteFollowSource: saved?.extraFields.noteFollowSource ?? false,
        descriptionFollowSource: saved?.extraFields.descriptionFollowSource ?? false,
      });
    }

    return [...byKey.values()].map((row) => ({
      ...row,
      ...(drafts[row.key] as Partial<TransferMappingRowDraft> | undefined),
    }));
  }, [loadTransferKeys.data, savedByKey, drafts]);

  const rows: MappingRowDraft[] = useMemo(
    () => [...genericRows, ...transferRows],
    [genericRows, transferRows]
  );

  return { rows };
}

const parseDescription = (raw: string | null): JSONContent | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as JSONContent;
  } catch {
    return null;
  }
};
