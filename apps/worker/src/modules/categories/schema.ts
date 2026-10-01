import { isValidUpdatedAt } from "../../shared/lww";

// Port dari category.schema.ts -- default type: 'expense', parent_id: null,
// is_active: true (SAMA dgn use-create-category.ts), SENGAJA TANPA
// validasi "parent.type === type" -- desktop juga tidak memvalidasi ini
// di level schema/hook, cuma filter dropdown UI. Lihat
// apps/worker/docs/todos/plan/cloud-sync.md utk catatan keputusan ini.
// `id` dari caller (PC generate uuidv7 sendiri) -- lihat shared/lww.ts.
export type CategoryPayload = {
  id: string;
  name: string;
  type: "income" | "expense";
  icon?: string | null;
  parentId?: string | null;
  isActive?: boolean;
  updatedAt?: string;
};

export function isCategoryPayload(value: unknown): value is CategoryPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    v.name.trim().length > 0 &&
    (v.type === "income" || v.type === "expense") &&
    (v.icon === undefined || v.icon === null || typeof v.icon === "string") &&
    (v.parentId === undefined || v.parentId === null || typeof v.parentId === "string") &&
    (v.isActive === undefined || typeof v.isActive === "boolean") &&
    (v.updatedAt === undefined || isValidUpdatedAt(v.updatedAt))
  );
}

// Port dari use-delete-category.ts (DeleteCategoryInput) -- category py
// DUA relasi independen yg masing2 wajib ditangani: sub-kategori
// (categories.parent_id = id ini) DAN transaksi (transactions.category_id
// = id ini). Masing2 py pasangan action/target sendiri.
export type DeleteCategoryPayload = {
  childAction?: "unassign" | "reassign";
  targetParentId?: string;
  transactionAction?: "unassign" | "reassign";
  targetCategoryId?: string;
};

export function isDeleteCategoryPayload(value: unknown): value is DeleteCategoryPayload {
  if (value === null || value === undefined) return true;
  if (typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const childActionValid =
    v.childAction === undefined || v.childAction === "unassign" || v.childAction === "reassign";
  const targetParentValid = v.targetParentId === undefined || typeof v.targetParentId === "string";
  const txActionValid =
    v.transactionAction === undefined ||
    v.transactionAction === "unassign" ||
    v.transactionAction === "reassign";
  const targetCategoryValid = v.targetCategoryId === undefined || typeof v.targetCategoryId === "string";
  return childActionValid && targetParentValid && txActionValid && targetCategoryValid;
}
