// Label efektif transaksi sebagai satu string (GROUP_CONCAT), dipecah lagi jadi array di sisi JS: label milik
// transaksi sendiri, dan kalau kosong, label kategorinya. Pemisahnya karakter kontrol (unit separator) karena
// nama label bebas teks, jadi koma biasa bisa ambigu. Semantik sama dengan extract-label-condition.ts.
const SEPARATOR = "\u001f";

export const EFFECTIVE_LABELS_SQL = `(
  CASE
    WHEN EXISTS (SELECT 1 FROM transaction_labels tl WHERE tl.transaction_id = transactions.id) THEN (
      SELECT GROUP_CONCAT(l.name, char(31)) FROM transaction_labels tl
      JOIN labels l ON l.id = tl.label_id
      WHERE tl.transaction_id = transactions.id
    )
    ELSE (
      SELECT GROUP_CONCAT(l.name, char(31)) FROM category_labels cl
      JOIN labels l ON l.id = cl.label_id
      WHERE cl.category_id = transactions.category_id
    )
  END
)`;

export function splitEffectiveLabels(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw.split(SEPARATOR).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
