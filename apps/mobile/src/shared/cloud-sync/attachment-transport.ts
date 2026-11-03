import { Directory, File, Paths, UploadType } from "expo-file-system";
import type { AttachmentTransport } from "./attachment-transport-types";
import { extensionFromContentType } from "./content-type";
import { WorkerRequestError, type PushResult } from "./worker-client";

const ATTACHMENTS_DIR_NAME = "transaction-attachments";

function attachmentsDirectory(): Directory {
  const dir = new Directory(Paths.document, ATTACHMENTS_DIR_NAME);
  if (!dir.exists) dir.create();
  return dir;
}

function baseUrl(workerUrl: string) {
  return workerUrl.replace(/\/$/, "");
}

// Upload dan download streaming lewat modul native: file tidak dimuat ke memori JS.
export const attachmentTransport: AttachmentTransport = {
  fileExists(path) {
    try {
      return new File(path).exists;
    } catch {
      return false;
    }
  },

  async upload(creds, { id, transactionId, filePath, contentType }): Promise<PushResult> {
    const result = await new File(filePath).upload(`${baseUrl(creds.workerUrl)}/attachments`, {
      httpMethod: "POST",
      uploadType: UploadType.MULTIPART,
      fieldName: "file",
      mimeType: contentType ?? undefined,
      parameters: { id, transactionId },
      headers: { Authorization: `Bearer ${creds.token}` },
    });

    if (result.status >= 200 && result.status < 300) {
      const parsed = safeJson(result.body) as { status?: string } | null;
      return parsed?.status === "ignored" ? { status: "ignored" } : { status: "ok" };
    }
    const message = (safeJson(result.body) as { error?: string } | null)?.error ?? `HTTP ${result.status}`;
    if (result.status === 422) return { status: "rejected", reason: message };
    throw new WorkerRequestError(result.status, message);
  },

  async download(creds, { id, contentType }) {
    const destination = new File(attachmentsDirectory(), `${id}.${extensionFromContentType(contentType)}`);
    try {
      await File.downloadFileAsync(`${baseUrl(creds.workerUrl)}/attachments/${encodeURIComponent(id)}`, destination, {
        headers: { Authorization: `Bearer ${creds.token}` },
        idempotent: true,
      });
    } catch (error) {
      // Unduhan Android yang gagal di tengah bisa meninggalkan file separuh.
      try {
        if (destination.exists) destination.delete();
      } catch {
        // abaikan
      }
      throw error;
    }
    return destination.uri;
  },

  deleteFile(path) {
    try {
      new File(path).delete();
    } catch {
      // best-effort, sama dengan deleteAttachmentFile
    }
  },
};

function safeJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
