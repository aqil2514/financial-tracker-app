export type AccountGroupPayload = {
  name: string;
};

export function isAccountGroupPayload(value: unknown): value is AccountGroupPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === "string" && v.name.trim().length > 0;
}
