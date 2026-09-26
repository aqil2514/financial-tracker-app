"use client";

import { useState } from "react";

import type { SetSyncSettings, UseDebtAccountsDraftOutput } from "../interfaces";

/**
 * Draft GABUNGAN untuk 2 field akun debt (piutang & utang) — satu
 * section, satu tombol "Simpan" untuk keduanya sekaligus, beda dari
 * `useSettingsDraft` yang men-draft satu field per instance.
 */
export function useDebtAccountsDraft(
  savedReceivableId: number | null,
  savedPayableId: number | null,
  setSyncSettings: SetSyncSettings
): UseDebtAccountsDraftOutput {
  const [receivableDraft, setReceivableDraft] = useState<number | null | undefined>(undefined);
  const [payableDraft, setPayableDraft] = useState<number | null | undefined>(undefined);

  const receivableDebtAccountId = receivableDraft !== undefined ? receivableDraft : savedReceivableId;
  const payableDebtAccountId = payableDraft !== undefined ? payableDraft : savedPayableId;

  const isDirty =
    (receivableDraft !== undefined && receivableDraft !== savedReceivableId) ||
    (payableDraft !== undefined && payableDraft !== savedPayableId);

  function handleSave() {
    if (!isDirty) return;
    setSyncSettings.mutate(
      {
        receivableDebtAccountId,
        payableDebtAccountId,
      },
      {
        onSuccess: () => {
          setReceivableDraft(undefined);
          setPayableDraft(undefined);
        },
      }
    );
  }

  return {
    receivableDebtAccountId,
    setReceivableDraft,
    payableDebtAccountId,
    setPayableDraft,
    isDirty,
    handleSave,
    isSaving: setSyncSettings.isPending,
  };
}
