"use client";

import { useEffect, useState } from "react";

import { useAccounts } from "@/features/accounts";
import {
  useRetailkuAccountMapping,
  useRetailkuPaymentAccounts,
  useSaveRetailkuAccountMapping,
  type SaveRetailkuAccountMappingInput,
} from "@/shared/retailku";
import type { LocalAccountOption } from "./account-mapping-row";

/**
 * State + logic untuk `AccountMappingList` — draft mapping di
 * `useState`, disinkronkan SEKALI dari mapping tersimpan begitu data
 * pertama kali datang (bukan tiap kali `savedMapping` berubah, mis.
 * setelah save sukses invalidate query, supaya draft yang sedang
 * diedit user tidak tertimpa balik), plus opsi akun lokal dan mapping
 * "orphan" (akun Retailku yang sudah tidak lagi `isPaymentMethod:true`
 * — lihat "Stabilitas retailku_account_id" di
 * retailku-account-mapping.md).
 */
export function useAccountMappingDraft() {
  const { data: retailkuAccounts, isLoading, isError, error } = useRetailkuPaymentAccounts();
  const { data: localAccounts } = useAccounts();
  const { data: savedMapping } = useRetailkuAccountMapping();
  const saveMapping = useSaveRetailkuAccountMapping();

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

  const currentAccountIds = new Set((retailkuAccounts ?? []).map((account) => account.id));
  const orphanMappings = (savedMapping ?? []).filter(
    (row) => !currentAccountIds.has(row.retailkuAccountId)
  );

  function setAccountMapping(retailkuAccountId: string, localAccountId: string | null) {
    setMapping((prev) => ({ ...prev, [retailkuAccountId]: localAccountId ?? "" }));
  }

  function handleSave() {
    if (!retailkuAccounts) return;
    const payload: SaveRetailkuAccountMappingInput = retailkuAccounts
      .filter((account) => mapping[account.id])
      .map((account) => ({
        retailkuAccountId: account.id,
        retailkuAccountCode: account.code,
        retailkuAccountName: account.name,
        localAccountId: Number(mapping[account.id]),
      }));
    saveMapping.mutate(payload);
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
    isSaving: saveMapping.isPending,
  };
}
