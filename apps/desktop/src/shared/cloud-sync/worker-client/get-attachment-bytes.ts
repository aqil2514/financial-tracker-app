import type { CloudSyncCredentials } from "./types";
import { WorkerRequestError } from "./worker-request-error";

export async function getAttachmentBytes(
  creds: CloudSyncCredentials,
  id: string
): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  const url = `${creds.workerUrl.replace(/\/$/, "")}/attachments/${encodeURIComponent(id)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${creds.token}` } });
  if (!response.ok) {
    throw new WorkerRequestError(response.status, `HTTP ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return { bytes: new Uint8Array(buffer), contentType: response.headers.get("Content-Type") };
}
