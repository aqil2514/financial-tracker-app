import { useMemo, useState } from "react";
import {
  MappingRowDraft,
  UseMappingCandidatesInput,
  UseMappingCandidatesOutput,
} from "../interfaces";
import { FieldMapping, useFieldMapping } from "@/shared/retailku";
import {
  MappingKeyCandidate,
} from "./use-load-mapping-keys";
import { JSONContent } from "@tiptap/react";

export function useMappingCandidates({
  loadKeys,
  mode,
}: UseMappingCandidatesInput): UseMappingCandidatesOutput {
  const { data: savedMapping } = useFieldMapping();
  const [drafts, setDrafts] = useState<
    Record<string, Partial<MappingRowDraft>>
  >({});

  const candidates: MappingKeyCandidate[] = loadKeys.data ?? [];

  const savedByKey = useMemo(() => {
    const map = new Map<string, FieldMapping>();
    for (const row of savedMapping ?? []) map.set(row.key, row);
    return map;
  }, [savedMapping]);

  const rows: MappingRowDraft[] = useMemo(() => {
    const byKey = new Map<string, MappingRowDraft>();

    for (const candidate of candidates) {
      const saved = savedByKey.get(candidate.key);
      byKey.set(candidate.key, {
        key: candidate.key,
        retailkuAccountId: candidate.retailkuAccountId,
        retailkuAccountCode: candidate.retailkuAccountCode,
        accountName: candidate.accountName,
        localAccountId: saved?.localAccountId ?? null,
        note: saved?.note ?? "",
        categoryId: saved?.categoryId ?? null,
        description: parseDescription(saved?.description ?? null),
      });
    }

    for (const saved of savedMapping ?? []) {
      if (byKey.has(saved.key)) continue;
      if (!saved.key.startsWith(`${mode}:`)) continue;
      byKey.set(saved.key, {
        key: saved.key,
        retailkuAccountId: saved.retailkuAccountId,
        retailkuAccountCode: saved.retailkuAccountCode,
        accountName: saved.retailkuAccountName,
        localAccountId: saved.localAccountId,
        note: saved.note ?? "",
        categoryId: saved.categoryId,
        description: parseDescription(saved.description),
      });
    }

    return [...byKey.values()].map((row) => ({ ...row, ...drafts[row.key] }));
  }, [candidates, savedByKey, savedMapping, drafts, mode]);

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
