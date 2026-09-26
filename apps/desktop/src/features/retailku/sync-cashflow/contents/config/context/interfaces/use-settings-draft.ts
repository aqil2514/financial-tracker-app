import { Dispatch, SetStateAction } from "react";
import type { RetailkuCashflowSyncSettings } from "../../../../sync";

export type SetSyncSettings = {
  mutate: (
    settings: Partial<RetailkuCashflowSyncSettings>,
    options?: { onSuccess?: () => void }
  ) => void;
  isPending: boolean;
};

export interface UseSettingsDraftOutput<K extends keyof RetailkuCashflowSyncSettings> {
  value: RetailkuCashflowSyncSettings[K];
  draft: RetailkuCashflowSyncSettings[K] | null;
  setDraft: Dispatch<SetStateAction<RetailkuCashflowSyncSettings[K] | null>>;
  isDirty: boolean;
  handleSave(): void;
  isSaving: boolean;
}
