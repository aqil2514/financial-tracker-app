import { isValidUpdatedAt } from "../../shared/lww";

// `id` dari caller (PC generate uuidv7 sendiri) -- lihat shared/lww.ts.
export type ContactPayload = {
  id: string;
  name: string;
  note?: string | null;
  updatedAt?: string;
};

export function isContactPayload(value: unknown): value is ContactPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    v.name.trim().length > 0 &&
    (v.note === undefined || v.note === null || typeof v.note === "string") &&
    (v.updatedAt === undefined || isValidUpdatedAt(v.updatedAt))
  );
}
