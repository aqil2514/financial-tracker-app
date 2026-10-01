import { isValidUpdatedAt } from "../../shared/lww";

// `id` WAJIB dari caller (PC generate uuidv7 sendiri, konsisten dgn
// uuid-migration.md & pola transactions) -- BUKAN server-generated lagi,
// supaya UPSERT bisa tahu "id mana yg mau ditulis" tanpa pull dulu.
// `updatedAt` opsional -- lihat shared/lww.ts utk kontrak lengkap LWW.
export type AccountGroupPayload = {
  id: string;
  name: string;
  updatedAt?: string;
};

export function isAccountGroupPayload(value: unknown): value is AccountGroupPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    v.name.trim().length > 0 &&
    (v.updatedAt === undefined || isValidUpdatedAt(v.updatedAt))
  );
}

// Port dari use-delete-account-group.ts (DeleteAccountGroupInput) --
// kalau grup masih py anggota (accounts.group_id = id ini), caller WAJIB
// pilih eksplisit: "unassign" (SET NULL) atau "reassign" (pindah ke
// targetGroupId). Kalau field ini tidak dikirim sama sekali DAN masih
// ada anggota, ON DELETE SET NULL skema yg jalan diam-diam (SAMA persis
// perilaku desktop kalau *Action tidak diisi).
export type DeleteAccountGroupPayload = {
  memberAction?: "unassign" | "reassign";
  targetGroupId?: string;
};

export function isDeleteAccountGroupPayload(value: unknown): value is DeleteAccountGroupPayload {
  if (value === null || value === undefined) return true;
  if (typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const actionValid =
    v.memberAction === undefined || v.memberAction === "unassign" || v.memberAction === "reassign";
  const targetValid = v.targetGroupId === undefined || typeof v.targetGroupId === "string";
  return actionValid && targetValid;
}
