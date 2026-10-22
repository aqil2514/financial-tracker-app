"use client";

import { useRetailkuAccountMapping } from "./use-retailku-account-mapping";
import { useRetailkuPaymentAccounts } from "./use-retailku-payment-accounts";
import type { RetailkuAccountMapping } from "./use-retailku-account-mapping";

/**
 * Mapping tersimpan yang akun Retailku-nya sudah TIDAK lagi
 * `isPaymentMethod: true` — lihat "Stabilitas retailku_account_id" di
 * retailku-account-mapping.md (titik 1: deteksi dini best-effort saat
 * app dibuka, BUKAN cuma prefetch). `useRetailkuPaymentAccounts()`
 * cuma mengembalikan akun yang MASIH `isPaymentMethod: true`, jadi
 * mapping yang `retailkuAccountId`-nya sudah tidak ada di situ berarti
 * akunnya baru saja dinonaktifkan di sisi Retailku.
 *
 * SAMA seperti `orphanMappings` di `use-account-mapping-draft.ts`
 * (halaman Mapping Akun) — diekstrak ke sini supaya dipakai ULANG oleh
 * `AppSidebar` (badge jumlah di menu "Retailku") tanpa duplikasi logic.
 * Best-effort: `enabled` mengikuti query underlying-nya sendiri (react
 * query diam saja kalau offline/kredensial belum lengkap), tidak
 * memblokir apa pun.
 */
export function useRetailkuMappingIssues() {
  const { data: retailkuAccounts, isLoading } = useRetailkuPaymentAccounts();
  const { data: savedMapping } = useRetailkuAccountMapping();

  const currentAccountIds = new Set((retailkuAccounts ?? []).map((account) => account.id));
  const deactivatedMappings: RetailkuAccountMapping[] = (savedMapping ?? []).filter(
    (row) => !currentAccountIds.has(row.retailkuAccountId)
  );

  return {
    deactivatedMappings,
    isLoading,
  };
}
