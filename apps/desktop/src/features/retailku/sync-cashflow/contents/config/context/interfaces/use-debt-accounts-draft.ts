import { Dispatch, SetStateAction } from "react";

export interface UseDebtAccountsDraftOutput {
  receivableDebtAccountId: number | null;
  setReceivableDraft: Dispatch<SetStateAction<number | null | undefined>>;
  payableDebtAccountId: number | null;
  setPayableDraft: Dispatch<SetStateAction<number | null | undefined>>;
  isDirty: boolean;
  handleSave(): void;
  isSaving: boolean;
}
