"use client";

import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAccounts } from "@/hooks/resources";
import type { Category } from "@/lib/db";
import type { MappingRowDraftPatch, TransferMappingRowDraft } from "../../context/interfaces";
import {
  fundTransferMappingSchema,
  type FundTransferMappingFormValues,
} from "./schema";

/** Hook form utk 1 baris mapping FUND_TRANSFER — SAMA pola
 * `useGenericMappingForm` (live-sync `useWatch` -> `updateDraft` di
 * Context, TIDAK ada tombol submit sendiri, tombol "Simpan Mapping"
 * GLOBAL yg baca `drafts` lintas semua key & submit sekali, lihat
 * `use-mapping-draft-save.ts`). SEBELUMNYA form ini PoC berdiri sendiri
 * (tombol submit sendiri, console.log) — DISATUKAN ke pola generic
 * 2026-09-28 setelah skema DB (`secondary_account_id` migrasi 0023,
 * `extra_fields` migrasi 0024) siap menampung hasilnya. */
export function useFundTransferMappingForm({
  row,
  onChange,
}: {
  row: TransferMappingRowDraft;
  onChange: (patch: MappingRowDraftPatch) => void;
}) {
  const { data: accounts } = useAccounts();

  const form = useForm<FundTransferMappingFormValues>({
    resolver: zodResolver(fundTransferMappingSchema),
    defaultValues: toFormValues(row),
  });

  useEffect(() => {
    form.reset(toFormValues(row));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset HANYA saat pindah key, bukan tiap perubahan row
  }, [row.key]);

  const fromAccountId = useWatch({ control: form.control, name: "fromAccountId" });
  const toAccountId = useWatch({ control: form.control, name: "toAccountId" });
  const categoryId = useWatch({ control: form.control, name: "categoryId" });
  const note = useWatch({ control: form.control, name: "note" });
  const description = useWatch({ control: form.control, name: "description" });
  const noteFollowSource = useWatch({ control: form.control, name: "noteFollowSource" });
  const descriptionFollowSource = useWatch({ control: form.control, name: "descriptionFollowSource" });

  useEffect(() => {
    onChange({
      localAccountId: fromAccountId ? Number(fromAccountId) : null,
      secondaryAccountId: toAccountId ? Number(toAccountId) : null,
      categoryId: categoryId ? Number(categoryId) : null,
      note: note ?? "",
      description: description ?? null,
      noteFollowSource: noteFollowSource ?? false,
      descriptionFollowSource: descriptionFollowSource ?? false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `onChange` (updateDraft) stabil dari Context, tidak perlu di deps
  }, [fromAccountId, toAccountId, categoryId, note, description, noteFollowSource, descriptionFollowSource]);

  const cashAccountOptions = useMemo(
    () =>
      (accounts ?? [])
        .filter((account) => account.is_active && account.account_type === "cash")
        .map((account) => ({
          value: String(account.id),
          label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
        })),
    [accounts],
  );

  return {
    form,
    cashAccountOptions,
    fromAccountId,
    toAccountId,
    noteFollowSource,
    descriptionFollowSource,
  };
}

function toFormValues(row: TransferMappingRowDraft): FundTransferMappingFormValues {
  return {
    key: row.key,
    fromAccountId: row.localAccountId != null ? String(row.localAccountId) : "",
    toAccountId: row.secondaryAccountId != null ? String(row.secondaryAccountId) : "",
    note: row.note,
    categoryId: row.categoryId != null ? String(row.categoryId) : null,
    description: row.description,
    noteFollowSource: row.noteFollowSource,
    descriptionFollowSource: row.descriptionFollowSource,
  };
}

export function categoryOptionsToComboboxItems(categoryOptions: Category[]) {
  return categoryOptions.map((category) => {
    const parentName = categoryOptions.find((parent) => parent.id === category.parent_id)?.name;
    return {
      value: String(category.id),
      label: parentName ? `${category.name} — ${parentName}` : category.name,
    };
  });
}
