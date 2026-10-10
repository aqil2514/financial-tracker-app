import type { CloudSyncCredentials } from "./types";
import { WorkerRequestError } from "./worker-request-error";
import type { PushUpsertResult } from "./push-upsert-result";

export type PushAttachmentPayload = {
  id: string;
  transactionId: string;
  bytes: Uint8Array;
  contentType: string | null;
  updatedAt?: string;
};

export async function pushAttachment(
  creds: CloudSyncCredentials,
  payload: PushAttachmentPayload
): Promise<PushUpsertResult> {
  const form = new FormData();
  form.set("id", payload.id);
  form.set("transactionId", payload.transactionId);
  if (payload.updatedAt) form.set("updatedAt", payload.updatedAt);
  const arrayBuffer = payload.bytes.buffer.slice(
    payload.bytes.byteOffset,
    payload.bytes.byteOffset + payload.bytes.byteLength
  ) as ArrayBuffer;
  form.set("file", new Blob([arrayBuffer], { type: payload.contentType ?? undefined }));

  const url = `${creds.workerUrl.replace(/\/$/, "")}/attachments`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.token}` },
    body: form,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = (body as { error?: string } | null)?.error ?? `HTTP ${response.status}`;
    if (response.status === 422) return { status: "rejected", reason: message };
    throw new WorkerRequestError(response.status, message);
  }
  const result = (await response.json()) as { status: "ok" | "ignored" };
  return result.status === "ignored" ? { status: "ignored" } : { status: "ok" };
}
