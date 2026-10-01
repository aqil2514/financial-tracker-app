export type ContactPayload = {
  name: string;
  note?: string | null;
};

export function isContactPayload(value: unknown): value is ContactPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === "string" &&
    v.name.trim().length > 0 &&
    (v.note === undefined || v.note === null || typeof v.note === "string")
  );
}
