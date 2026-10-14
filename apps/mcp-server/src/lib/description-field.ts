import { z } from "zod";

// Kolom `description` transaksi SELALU TipTap doc JSON (lihat rich-text
// editor desktop, apps/desktop/src/components/rich-text) -- sebelum ini
// cuma `z.string().optional()` tanpa constraint, jadi plain text (mis.
// "Ketoprak") lolos sampai D1 lalu bikin RichTextViewer crash (JSON.parse
// gagal) saat baris itu dibuka di desktop. Worker sekarang juga menolak
// bentuk yg salah (lihat apps/worker/src/shared/tiptap-doc.ts) -- validasi
// di sini cuma supaya Claude dapat pesan error jelas LEBIH AWAL, sebelum
// request dikirim ke Worker.
function isValidTiptapDocString(value: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return false;
  }
  return (
    typeof parsed === "object" &&
    parsed !== null &&
    (parsed as Record<string, unknown>).type === "doc" &&
    Array.isArray((parsed as Record<string, unknown>).content)
  );
}

export const descriptionField = z
  .string()
  .refine(isValidTiptapDocString, {
    message:
      "description harus string hasil JSON.stringify() dari dokumen TipTap, contoh: " +
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"isi teksnya"}]}]} ' +
      "-- BUKAN plain text biasa.",
  })
  .optional()
  .describe(
    "Opsional, catatan tambahan panjang (beda dari `note` yg judul singkat). " +
      "HARUS string hasil JSON.stringify() dari dokumen TipTap " +
      '({"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"..."}]}]}), ' +
      "SAMA format dgn rich text editor di desktop app -- JANGAN kirim plain text, akan ditolak."
  );
