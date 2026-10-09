import { isValidUpdatedAt } from "../../shared/lww";

export const LABEL_SCOPES = ["transaction_category", "account"] as const;
export type LabelScope = (typeof LABEL_SCOPES)[number];

// Scope junction -- MENENTUKAN tabel mana yg disentuh attach/detach/list
// entity-label (lihat router.ts), BEDA dari LabelScope ('transaction_category'
// dipakai BERSAMA oleh transactions & categories, lihat
// docs/todos/plan/general-label.md "scope final 2 nilai").
export const ENTITY_SCOPES = ["transactions", "categories", "accounts"] as const;
export type EntityScope = (typeof ENTITY_SCOPES)[number];

// `id` WAJIB dari caller (PC generate uuidv7), pola sama account_groups.
export type LabelPayload = {
  id: string;
  name: string;
  scope: LabelScope;
  updatedAt?: string;
};

export function isLabelPayload(value: unknown): value is LabelPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    v.name.trim().length > 0 &&
    typeof v.scope === "string" &&
    (LABEL_SCOPES as readonly string[]).includes(v.scope) &&
    (v.updatedAt === undefined || isValidUpdatedAt(v.updatedAt))
  );
}

export function isEntityScope(value: unknown): value is EntityScope {
  return typeof value === "string" && (ENTITY_SCOPES as readonly string[]).includes(value);
}

// Attach: id junction row (bukan id label) WAJIB dari caller, sama
// alasan dgn LabelPayload.id -- lihat "Draf skema" di general-label.md.
export type AttachLabelPayload = {
  id: string;
  labelId: string;
  updatedAt?: string;
};

export function isAttachLabelPayload(value: unknown): value is AttachLabelPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.labelId === "string" &&
    (v.updatedAt === undefined || isValidUpdatedAt(v.updatedAt))
  );
}
