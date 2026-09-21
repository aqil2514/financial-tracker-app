"use client";

import { useAccounts } from "@/hooks/resources/use-accounts";
import { useRetailkuAccountMapping, useRetailkuSettings } from "@/shared/retailku";

/**
 * Prasyarat sync: mapping akun Retailku sudah ada (CUKUP ada, tidak
 * perlu seragam ke satu akun lokal — lihat catatan di
 * use-cashflow-config.ts), kredensial Retailku tersimpan, dan daftar
 * akun kas/debt lokal untuk dipilih di field-field konfigurasi. Murni
 * derived dari query, tidak ada mutation di sini.
 */
export function useSyncPrerequisites() {
  const { data: mappings, isLoading: mappingsLoading } = useRetailkuAccountMapping();
  const { data: accounts } = useAccounts();
  const { data: retailkuSettings } = useRetailkuSettings();

  const hasMappings = (mappings?.length ?? 0) > 0;
  const cashAccountOptions =
    accounts?.filter((account) => account.account_type === "cash" && account.is_active) ?? [];
  const debtAccountOptions =
    accounts?.filter((account) => account.account_type === "debt" && account.is_active) ?? [];
  const hasCredentials = !!retailkuSettings?.mcpUrl && !!retailkuSettings?.apiKey;

  return {
    mappingsLoading,
    hasMappings,
    mappingCount: mappings?.length ?? 0,
    cashAccountOptions,
    debtAccountOptions,
    retailkuSettings,
    hasCredentials,
  };
}
