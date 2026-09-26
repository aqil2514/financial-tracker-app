"use client";

import { useSyncPrerequisites } from "./use-sync-prerequisites";
import { useCashflowSyncFields } from "./use-cashflow-sync-fields";
import { useDebtAccountsDraft } from "./use-debt-accounts-draft";
import { useSyncFromDraft } from "./use-sync-from-draft";
import { useSyncNow } from "./use-sync-now";
import { usePreviewSync } from "./use-preview-sync";
import { UseCashflowConfigOutput } from "../interfaces";

/**
 * Orkestrator tab "Konfigurasi" — gabungan 6 hook fokus di folder ini,
 * dikembalikan per-namespace (bukan di-flatten) supaya caller
 * men-destructure sendiri bagian yang relevan.
 *
 * `canSync`/`canPreview` (di `useSyncNow`) TIDAK mensyaratkan mapping
 * sudah lengkap — sync per baris skip sendiri key yang belum dipetakan
 * (toast "Lengkapi di tab Mapping"), jadi gate di sini cuma akan
 * memblokir baris lain yang justru valid.
 */
export function useCashflowConfig(): UseCashflowConfigOutput {
  const prerequisites = useSyncPrerequisites();
  const fields = useCashflowSyncFields();
  const debtAccounts = useDebtAccountsDraft(
    fields.syncSettings?.receivableDebtAccountId ?? null,
    fields.syncSettings?.payableDebtAccountId ?? null,
    fields.setSyncSettings
  );
  const syncFrom = useSyncFromDraft(fields.syncSettings?.syncFrom ?? null, fields.setSyncSettings);
  const syncNow = useSyncNow({
    hasCredentials: prerequisites.hasCredentials,
    retailkuSettings: prerequisites.retailkuSettings,
    mode: fields.mode.value,
    arApCashAccountId: fields.arApCashAccountId.value?.toString() ?? "",
    receivableDebtAccountId: debtAccounts.receivableDebtAccountId?.toString() ?? "",
    payableDebtAccountId: debtAccounts.payableDebtAccountId?.toString() ?? "",
    syncFromValue: syncFrom.syncFromValue,
    onSynced: syncFrom.advanceSyncFromToToday,
  });

  const preview = usePreviewSync();

  return { prerequisites, fields, debtAccounts, syncFrom, syncNow, preview };
}
