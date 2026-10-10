import { request } from "./request";
import type { CloudSyncCredentials } from "./types";

export type AttachmentListItem = {
  id: string;
  transactionId: string;
  contentType: string | null;
  sizeBytes: number | null;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type AttachmentListResponse = { checkpoint: string; attachments: AttachmentListItem[] };

export function listAttachmentsSince(
  creds: CloudSyncCredentials,
  since: string | null
): Promise<AttachmentListResponse> {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  return request(creds, `/attachments${query}`);
}
