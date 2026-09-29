"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { JSONContent } from "@tiptap/react";

import type { ArApMappingRowDraft, MappingRowDraftPatch } from "../../context/interfaces";
import { arApMappingSchema, type ArApMappingFormValues } from "./schema";

/** Hook form utk 1 baris mapping AR_AP — SAMA pola live-sync
 * `useGenericMappingForm`/`useFundTransferMappingForm` (TIDAK ada
 * tombol submit sendiri, tombol "Simpan Mapping" GLOBAL yg submit
 * semua varian sekaligus). */
export function useArApMappingForm({
  row,
  onChange,
}: {
  row: ArApMappingRowDraft;
  onChange: (patch: MappingRowDraftPatch) => void;
}) {
  const form = useForm<ArApMappingFormValues>({
    resolver: zodResolver(arApMappingSchema),
    defaultValues: toFormValues(row),
  });

  useEffect(() => {
    form.reset(toFormValues(row));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset HANYA saat pindah key, bukan tiap perubahan row
  }, [row.key]);

  const localAccountId = useWatch({ control: form.control, name: "localAccountId" });
  const contactId = useWatch({ control: form.control, name: "contactId" });
  const contactFollowSource = useWatch({ control: form.control, name: "contactFollowSource" });
  const note = useWatch({ control: form.control, name: "note" });
  const description = useWatch({ control: form.control, name: "description" });

  useEffect(() => {
    onChange({
      localAccountId: localAccountId ? localAccountId : null,
      contactId: contactId ? contactId : null,
      contactFollowSource: contactFollowSource ?? false,
      note: note ?? "",
      description: (description as JSONContent | null) ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `onChange` (updateDraft) stabil dari Context, tidak perlu di deps
  }, [localAccountId, contactId, contactFollowSource, note, description]);

  return { form, contactFollowSource };
}

function toFormValues(row: ArApMappingRowDraft): ArApMappingFormValues {
  return {
    key: row.key,
    localAccountId: row.localAccountId != null ? String(row.localAccountId) : "",
    contactId: row.contactId != null ? String(row.contactId) : null,
    contactFollowSource: row.contactFollowSource,
    note: row.note,
    description: row.description,
  };
}
