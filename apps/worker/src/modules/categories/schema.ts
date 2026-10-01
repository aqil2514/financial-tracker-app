// Port dari category.schema.ts -- default type: 'expense', parent_id: null,
// is_active: true (SAMA dgn use-create-category.ts), SENGAJA TANPA
// validasi "parent.type === type" -- desktop juga tidak memvalidasi ini
// di level schema/hook, cuma filter dropdown UI. Lihat
// apps/worker/docs/todos/plan/cloud-sync.md utk catatan keputusan ini.
export type CategoryPayload = {
  name: string;
  type: "income" | "expense";
  icon?: string | null;
  parentId?: string | null;
  isActive?: boolean;
};

export function isCategoryPayload(value: unknown): value is CategoryPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === "string" &&
    v.name.trim().length > 0 &&
    (v.type === "income" || v.type === "expense") &&
    (v.icon === undefined || v.icon === null || typeof v.icon === "string") &&
    (v.parentId === undefined || v.parentId === null || typeof v.parentId === "string") &&
    (v.isActive === undefined || typeof v.isActive === "boolean")
  );
}
