import type { JSONContent } from "@tiptap/react";

/** Dokumen Tiptap kosong (baru dibuat, atau semua isinya dihapus user)
 * masih berupa objek JSON valid seperti
 * `{ type: "doc", content: [{ type: "paragraph" }] }` — bukan `null`
 * atau string kosong — jadi perlu dicek strukturnya, bukan cuma truthy
 * check, untuk tahu apakah description sebenarnya "belum diisi". */
export function isEmptyDoc(value: JSONContent | null | undefined): boolean {
  if (!value || !value.content) return true;
  return value.content.every(
    (node) => node.type === "paragraph" && !node.content?.length
  );
}
