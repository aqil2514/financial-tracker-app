import { isValidUpdatedAt } from "../../shared/lww";

// Payload upload dikirim sbg multipart/form-data (bukan JSON) krn ada
// file binary -- lihat controller.ts `handlePostAttachment` utk cara
// Hono mem-parse-nya (`c.req.parseBody()`).
export type AttachmentUploadFields = {
  id: string;
  transactionId: string;
  updatedAt?: string;
};

export function isAttachmentUploadFields(value: unknown): value is AttachmentUploadFields {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id.trim().length > 0 &&
    typeof v.transactionId === "string" &&
    v.transactionId.trim().length > 0 &&
    (v.updatedAt === undefined || isValidUpdatedAt(v.updatedAt))
  );
}

export type SinceParamResult = { valid: true; since: string | null } | { valid: false };

// Sama pola dgn modules/sync/schema.ts -- `since` opsional, format TEXT
// identik `updated_at` ("YYYY-MM-DD HH:mm:ss").
export function parseSinceParam(value: string | undefined): SinceParamResult {
  if (value === undefined) return { valid: true, since: null };
  if (!isValidUpdatedAt(value)) return { valid: false };
  return { valid: true, since: value };
}
