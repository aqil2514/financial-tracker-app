"use client";

import { useEffect, useState } from "react";

import { useAccounts } from "@/features/accounts";
import {
  useRetailkuAccountMapping,
  useRetailkuMappingIssues,
  useRetailkuPaymentAccounts,
} from "@/shared/retailku";
import type { LocalAccountOption } from "./account-mapping-row";

/**
 * SEMENTARA TIDAK DIPAKAI (2026-09-23, lihat
 * app/(app)/retailku/mapping/page.tsx) — dipertahankan sebagai
 * REFERENSI pola UI (dropdown akun, deteksi orphan mapping) untuk UI
 * mapping baru yang belum dibangun, lihat
 * docs/todos/plan/retailku-sync-field-mapping.md. `handleSave` sengaja
 * jadi no-op: `useSaveRetailkuAccountMapping` sudah dihapus karena
 * tabel tujuannya (`retailku_account_mapping`) sudah di-drop migrasi
 * `0020_retailku_sync_field_mapping.sql` — UI baru akan menulis ke
 * `retailku_sync_field_mapping` dengan bentuk field yang BEDA (per
 * key, bukan per akun), bukan sekadar sambungkan ulang mutation ini.
 *
 * State + logic untuk `AccountMappingList` — draft mapping di
 * `useState`, disinkronkan SEKALI dari mapping tersimpan begitu data
 * pertama kali datang (bukan tiap kali `savedMapping` berubah, mis.
 * setelah save sukses invalidate query, supaya draft yang sedang
 * diedit user tidak tertimpa balik), plus opsi akun lokal dan mapping
 * "orphan" — dihitung lewat `useRetailkuMappingIssues()` (SAMA
 * dipakai `AppSidebar` untuk badge jumlah di menu "Retailku"), akun
 * Retailku yang sudah tidak lagi `isPaymentMethod:true` — lihat
 * "Stabilitas retailku_account_id" di retailku-account-mapping.md.
 */
export function useAccountMappingDraft() {
  const { data: retailkuAccounts, isLoading, isError, error } = useRetailkuPaymentAccounts();
  const { data: localAccounts } = useAccounts();
  const { data: savedMapping } = useRetailkuAccountMapping();

  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated || !savedMapping) return;
    if (savedMapping.length > 0) {
      setMapping(
        Object.fromEntries(
          savedMapping.map((row) => [row.retailkuAccountId, String(row.localAccountId)])
        )
      );
    }
    setHydrated(true);
  }, [hydrated, savedMapping]);

  const localAccountOptions: LocalAccountOption[] =
    localAccounts
      ?.filter((account) => account.is_active && account.account_type === "cash")
      .map((account) => ({
        value: String(account.id),
        label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
      })) ?? [];

  const { deactivatedMappings: orphanMappings } = useRetailkuMappingIssues();

  function setAccountMapping(retailkuAccountId: string, localAccountId: string | null) {
    setMapping((prev) => ({ ...prev, [retailkuAccountId]: localAccountId ?? "" }));
  }

  function handleSave() {
    // No-op sengaja — lihat catatan di atas fungsi ini. Tidak ada
    // mutation aktif untuk skema `retailku_sync_field_mapping` dari
    // sini; UI baru akan punya mutation-nya sendiri.
  }

  return {
    retailkuAccounts,
    isLoading,
    isError,
    error,
    mapping,
    setAccountMapping,
    localAccountOptions,
    orphanMappings,
    handleSave,
    isSaving: false,
  };
}
