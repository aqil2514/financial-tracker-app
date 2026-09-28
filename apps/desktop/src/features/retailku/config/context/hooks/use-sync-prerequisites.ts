"use client";

import { useAccounts } from "@/hooks/resources/use-accounts";
import { useRetailkuSettings } from "@/shared/retailku";
import { UseSyncPrerequisitesOutput } from "../interfaces";

/**
 * Prasyarat sync: kredensial Retailku tersimpan, dan daftar akun
 * kas/debt lokal untuk dipilih di field-field konfigurasi. Murni derived
 * dari query, tidak ada mutation di sini — TIDAK mengecek mapping akun
 * (lihat `useCashflowConfig` kenapa itu bukan syarat keseluruhan sync).
 */
export function useSyncPrerequisites(): UseSyncPrerequisitesOutput {
  const { data: accounts } = useAccounts();
  const { data: retailkuSettings } = useRetailkuSettings();

  const cashAccountOptions =
    accounts?.filter((account) => account.account_type === "cash" && account.is_active) ?? [];
  const debtAccountOptions =
    accounts?.filter((account) => account.account_type === "debt" && account.is_active) ?? [];
  const hasCredentials = !!retailkuSettings?.mcpUrl && !!retailkuSettings?.apiKey;

  return {
    cashAccountOptions,
    debtAccountOptions,
    retailkuSettings,
    hasCredentials,
  };
}
