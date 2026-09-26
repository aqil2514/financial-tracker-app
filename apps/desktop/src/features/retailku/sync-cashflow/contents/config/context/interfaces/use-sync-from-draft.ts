import { Dispatch, SetStateAction } from "react";

export interface UseSyncFromDraftOutput {
  syncFromValue: string;
  savedSyncFrom: string | null;
  syncFromDraft: string | null;
  setSyncFromDraft: Dispatch<SetStateAction<string | null>>;
  handleSaveSyncFrom(): void;
  advanceSyncFromToToday(today: string): void;
  isSaving: boolean;
}
