export type CorrectAccountBalancePayload = {
  accountId: string;
  targetBalance: number;
};

export function isCorrectAccountBalancePayload(
  value: unknown
): value is CorrectAccountBalancePayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.accountId === "string" && typeof v.targetBalance === "number";
}

// Port dari use-delete-account.ts (DeleteAccountInput) -- akun dipakai
// di DUA kolom transactions (account_id DAN transfer_account_id),
// keduanya WAJIB ditangani bareng saat reassign/unassign (beda dari
// account_groups/categories yg cuma 1 kolom).
export type DeleteAccountPayload = {
  transactionAction?: "unassign" | "reassign";
  targetAccountId?: string;
};

export function isDeleteAccountPayload(value: unknown): value is DeleteAccountPayload {
  if (value === null || value === undefined) return true;
  if (typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const actionValid =
    v.transactionAction === undefined ||
    v.transactionAction === "unassign" ||
    v.transactionAction === "reassign";
  const targetValid = v.targetAccountId === undefined || typeof v.targetAccountId === "string";
  return actionValid && targetValid;
}
