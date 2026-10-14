import type { JSONContent } from "@tiptap/react";

/** Parse kolom `description` (string TipTap JSON dari DB) dengan aman.
 * Baris lama/korup (mis. ditulis manual via MCP sebagai plain text,
 * bukan TipTap JSON) tidak boleh membuat UI crash -- fallback-nya
 * dibungkus jadi paragraf teks biasa. */
export function parseDescription(value: string | null | undefined): JSONContent | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
    };
  }
}
