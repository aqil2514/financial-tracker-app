import { isValidUpdatedAt } from "../../shared/lww";

export function parseSinceParam(value: string | undefined): { valid: true; since: string | null } | { valid: false } {
  if (value === undefined || value === "") return { valid: true, since: null };
  if (!isValidUpdatedAt(value)) return { valid: false };
  return { valid: true, since: value };
}
