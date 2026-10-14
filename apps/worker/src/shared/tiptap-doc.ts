// Validasi bentuk minimal kolom `description` -- SELALU string hasil
// JSON.stringify() dari TipTap doc ({ type: "doc", content: [...] }),
// dikirim desktop (push-transaction-row.ts) maupun MCP (create/update
// transaction). Bukan validasi skema node TipTap lengkap (banyak node
// type dari StarterKit) -- cukup pastikan bentuk luarnya benar, supaya
// plain text (mis. MCP keliru kirim "Ketoprak") ditolak di sini,
// bukan baru crash saat dirender RichTextViewer di desktop.
export function isValidTiptapDocString(value: unknown): boolean {
  if (typeof value !== "string") return false;
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
