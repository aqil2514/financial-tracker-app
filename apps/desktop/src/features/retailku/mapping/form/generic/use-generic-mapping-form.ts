"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { JSONContent } from "@tiptap/react";

import type { GenericMappingRowDraft, MappingRowDraftPatch } from "../../context/interfaces";
import { genericMappingSchema, type GenericMappingFormValues } from "./schema";

/** Hook form utk 1 baris mapping generik — BEDA dari form biasa: TIDAK
 * ada tombol submit sendiri, `useWatch` melapor tiap perubahan LANGSUNG
 * ke `updateDraft` di Context (tombol "Simpan Mapping" GLOBAL di luar
 * yang baca `drafts` lintas semua key & submit sekali, lihat
 * `use-mapping-draft-save.ts`). RHF di sini murni utk render+validasi
 * per field (pesan error combobox/text), BUKAN gate submit — sengaja
 * dipertahankan (user eksplisit: tombol simpan tetap 1 utk semua key). */
export function useGenericMappingForm({
  row,
  onChange,
}: {
  row: GenericMappingRowDraft;
  onChange: (patch: MappingRowDraftPatch) => void;
}) {
  const form = useForm<GenericMappingFormValues>({
    resolver: zodResolver(genericMappingSchema),
    defaultValues: toFormValues(row),
    // `row.key` beda -> user pindah tab ArrayFieldTabs, form di-reset
    // ke draft key baru (lihat effect di bawah).
  });

  useEffect(() => {
    form.reset(toFormValues(row));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset HANYA saat pindah key, bukan tiap perubahan row
  }, [row.key]);

  const localAccountId = useWatch({ control: form.control, name: "localAccountId" });
  const categoryId = useWatch({ control: form.control, name: "categoryId" });
  const note = useWatch({ control: form.control, name: "note" });
  const description = useWatch({ control: form.control, name: "description" });
  const noteFollowSource = useWatch({ control: form.control, name: "noteFollowSource" });
  const descriptionFollowSource = useWatch({ control: form.control, name: "descriptionFollowSource" });

  useEffect(() => {
    onChange({
      localAccountId: localAccountId ? localAccountId : null,
      categoryId: categoryId ? categoryId : null,
      note: note ?? "",
      description: (description as JSONContent | null) ?? null,
      noteFollowSource: noteFollowSource ?? false,
      descriptionFollowSource: descriptionFollowSource ?? false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `onChange` (updateDraft) stabil dari Context, tidak perlu di deps
  }, [localAccountId, categoryId, note, description, noteFollowSource, descriptionFollowSource]);

  return { form, noteFollowSource, descriptionFollowSource };
}

function toFormValues(row: GenericMappingRowDraft): GenericMappingFormValues {
  return {
    key: row.key,
    localAccountId: row.localAccountId != null ? String(row.localAccountId) : "",
    categoryId: row.categoryId != null ? String(row.categoryId) : null,
    note: row.note,
    description: row.description,
    noteFollowSource: row.noteFollowSource,
    descriptionFollowSource: row.descriptionFollowSource,
  };
}
