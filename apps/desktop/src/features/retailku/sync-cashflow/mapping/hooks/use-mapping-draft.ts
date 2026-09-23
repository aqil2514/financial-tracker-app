"use client";

import { useMemo, useState } from "react";
import type { JSONContent } from "@tiptap/react";

import { isEmptyDoc } from "@/components/rich-text";
import { useAccounts } from "@/hooks/resources/use-accounts";
import { useCategories } from "@/hooks/resources/use-categories";
import {
  useFieldMapping,
  useRetailkuSettings,
  useSaveFieldMapping,
  type FieldMapping,
  type SaveFieldMappingInput,
} from "@/shared/retailku";
import type { RetailkuCashflowSyncMode } from "../../sync";
import {
  useLoadMappingKeys,
  type MappingKeyCandidate,
} from "./use-load-mapping-keys";

export type MappingRowDraft = {
  key: string;
  retailkuAccountId: string;
  retailkuAccountCode: string;
  accountName: string;
  localAccountId: number | null;
  note: string;
  categoryId: number | null;
  /** Dokumen Tiptap JSON (SAMA seperti `description` di form transaksi,
   * lihat schema.ts/use-create-transaction.ts) — disimpan di DB sebagai
   * JSON string di kolom `retailku_sync_field_mapping.description`
   * (TEXT), di-parse jadi objek di level draft supaya bisa dipakai
   * langsung oleh RichTextEditor tanpa parse berulang tiap render. */
  description: JSONContent | null;
};

/** `FieldMapping.description` mentah dari DB berupa JSON string (atau
 * `null`) — parse sekali di sini, BUKAN di tiap pemakaian. */
function parseDescription(raw: string | null): JSONContent | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as JSONContent;
  } catch {
    return null;
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

/**
 * State + logic tab "Mapping" (baru) — beda dari
 * `use-account-mapping-draft.ts` lama (SEMENTARA tidak dipakai, lihat
 * catatan di file itu): draft di sini levelnya per KEY (bisa
 * akun+arah untuk summary, akun+sourceType+arah untuk detail), BUKAN
 * per akun, dan field yang di-draft lebih banyak (note/category/
 * description, bukan cuma akun tujuan) — lihat
 * docs/todos/plan/retailku-sync-field-mapping.md.
 *
 * Alur: 1) user pilih rentang tanggal+mode, tekan "Muat Key" →
 * `useLoadMappingKeys` (baca-saja, panggil MCP via `computeCashflowSync`,
 * SAMA seperti Preview Sync) — dapat SEMUA key yang relevan. 2) Key itu
 * DIGABUNG dengan `useFieldMapping` (baca dari
 * `retailku_sync_field_mapping`) jadi draft form — key yang SUDAH ada
 * mapping-nya terisi otomatis, yang belum kosong. 3) User edit,
 * `handleSave` UPSERT semua baris yang dianggap "siap" (`localAccountId`
 * terisi) sekaligus.
 */
export function useMappingDraft() {
  const { data: retailkuSettings } = useRetailkuSettings();
  const { data: localAccounts } = useAccounts();
  const { data: categories } = useCategories();
  const { data: savedMapping } = useFieldMapping();
  const saveMapping = useSaveFieldMapping();
  const loadKeys = useLoadMappingKeys();

  const [mode, setMode] = useState<RetailkuCashflowSyncMode>("detail");
  const [dateFrom, setDateFrom] = useState(daysAgoIso(30));
  const [dateTo, setDateTo] = useState(todayIso());
  const [drafts, setDrafts] = useState<
    Record<string, Partial<MappingRowDraft>>
  >({});

  const savedByKey = useMemo(() => {
    const map = new Map<string, FieldMapping>();
    for (const row of savedMapping ?? []) map.set(row.key, row);
    return map;
  }, [savedMapping]);

  function handleLoadKeys() {
    loadKeys.mutate({ retailkuSettings, mode, dateFrom, dateTo });
  }

  const candidates: MappingKeyCandidate[] = loadKeys.data ?? [];

  // Baris yang ditampilkan: gabungan candidate (dari MCP) + mapping
  // tersimpan (kalau ADA tapi TIDAK muncul di candidate rentang
  // tanggal ini — tetap ditampilkan supaya user tidak kehilangan
  // akses edit ke mapping lama yang sudah pernah diatur). Mapping
  // tersimpan DIFILTER by prefix `key` sesuai `mode` aktif (`summary:`
  // vs `detail:`) — TANPA filter ini, mapping lama dari mode LAIN ikut
  // muncul terlepas mode yang dipilih (bug ditemukan live: pilih mode
  // "detail" tapi daftar tetap menampilkan key `summary:*` lama yang
  // sudah tersimpan).
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

  function updateDraft(key: string, patch: Partial<MappingRowDraft>) {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  const isDirty = Object.keys(drafts).length > 0;

  function handleSave() {
    const payload: SaveFieldMappingInput = rows
      .filter((row) => drafts[row.key] && row.localAccountId != null)
      .map((row) => ({
        key: row.key,
        retailkuAccountId: row.retailkuAccountId,
        retailkuAccountCode: row.retailkuAccountCode,
        retailkuAccountName: row.accountName,
        localAccountId: row.localAccountId!,
        note: row.note.trim() === "" ? null : row.note,
        categoryId: row.categoryId,
        description: isEmptyDoc(row.description) ? null : JSON.stringify(row.description),
      }));
    if (payload.length === 0) return;
    saveMapping.mutate(payload, { onSuccess: () => setDrafts({}) });
  }

  return {
    mode,
    setMode,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    handleLoadKeys,
    isLoadingKeys: loadKeys.isPending,
    loadKeysError: loadKeys.error,
    hasLoadedKeys: loadKeys.isSuccess,
    rows,
    updateDraft,
    isDirty,
    handleSave,
    isSaving: saveMapping.isPending,
    localAccountOptions: (localAccounts ?? []).filter(
      (account) => account.is_active && account.account_type === "cash",
    ),
    categoryOptions: categories ?? [],
  };
}
