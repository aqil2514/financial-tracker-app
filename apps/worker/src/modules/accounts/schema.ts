import { isValidUpdatedAt } from "../../shared/lww";
import { isAccountType, type AccountType } from "../../shared/account-types";

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

// Port dari account.schema.ts (Zod) + use-create-account.ts -- TIDAK ADA
// validasi bisnis non-trivial, cuma required field `name`. `color`
// default `"slate"` di desktop (DEFAULT_ACCOUNT_COLOR, konstanta
// KOSMETIK UI, bukan logic bisnis) -- kalau caller tidak kirim, Worker
// biarkan `null` (BEDA kecil dari desktop yg SELALU isi default di form,
// tapi caller non-UI spt tool MCP wajar tidak peduli warna).
export type AccountPayload = {
  id: string;
  name: string;
  initialBalance: number;
  groupId?: string | null;
  description?: string | null;
  isActive?: boolean;
  accountType: AccountType;
  icon?: string | null;
  color?: string | null;
  updatedAt?: string;
};

export function isAccountPayload(value: unknown): value is AccountPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    v.name.trim().length > 0 &&
    typeof v.initialBalance === "number" &&
    (v.groupId === undefined || v.groupId === null || typeof v.groupId === "string") &&
    (v.description === undefined || v.description === null || typeof v.description === "string") &&
    (v.isActive === undefined || typeof v.isActive === "boolean") &&
    isAccountType(v.accountType) &&
    (v.icon === undefined || v.icon === null || typeof v.icon === "string") &&
    (v.color === undefined || v.color === null || typeof v.color === "string") &&
    (v.updatedAt === undefined || isValidUpdatedAt(v.updatedAt))
  );
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
