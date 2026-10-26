import { Directory, File, Paths } from "expo-file-system";
import { copyAsync } from "expo-file-system/legacy";
import { generateId } from "@/lib/database";

const ATTACHMENTS_DIR_NAME = "transaction-attachments";

function getAttachmentsDirectory(): Directory {
  const dir = new Directory(Paths.document, ATTACHMENTS_DIR_NAME);
  if (!dir.exists) dir.create();
  return dir;
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot);
}

// expo-document-picker bisa mengembalikan URI "content://" (Storage
// Access Framework) alih-alih "file://" — File.copy() (API baru) belum
// bisa diandalkan untuk itu (gagal "Missing READ permission", lihat
// expo/expo#42343). copyAsync dari legacy API didesain eksplisit untuk
// "copy content shared by other apps to local filesystem", jadi dipakai
// di sini untuk kasus ini saja.
export async function saveAttachmentFile(sourceUri: string, originalName: string): Promise<string> {
  const destination = new File(getAttachmentsDirectory(), `${generateId()}${extensionOf(originalName)}`);
  await copyAsync({ from: sourceUri, to: destination.uri });
  return destination.uri;
}

export function deleteAttachmentFile(filePath: string) {
  try {
    new File(filePath).delete();
  } catch {
    // ignore
  }
}
