import type { Transaction } from "@/lib/db";

export const HAS_ATTACHMENT_SUBQUERY =
  "EXISTS (SELECT 1 FROM transaction_attachments WHERE transaction_attachments.transaction_id = transactions.id)";

// `transaction_attachments` desktop TIDAK punya kolom content_type (cuma
// `file_path`, beda dari skema Worker/D1) -- deteksi PDF dari ekstensi
// file_path, pola sama `isPdfAttachment` di attachment-thumbnail.tsx.
export const HAS_PDF_ATTACHMENT_SUBQUERY =
  "EXISTS (SELECT 1 FROM transaction_attachments WHERE transaction_attachments.transaction_id = transactions.id AND transaction_attachments.file_path LIKE '%.pdf')";
export const HAS_IMAGE_ATTACHMENT_SUBQUERY =
  "EXISTS (SELECT 1 FROM transaction_attachments WHERE transaction_attachments.transaction_id = transactions.id AND transaction_attachments.file_path NOT LIKE '%.pdf')";

// Delimiter GROUP_CONCAT -- sengaja karakter kontrol (unit separator,
// U+001F) yang TIDAK MUNGKIN diketik lewat keyboard biasa atau muncul
// natural dalam nama label, BUKAN koma biasa (nama label bebas teks,
// "Beli, Jual" valid sbg satu nama -- koma biasa akan ambigu saat
// displit balik di to-transactions-page-result.ts).
const LABEL_DELIMITER = "";

// Label EFEKTIF transaksi (hasil resolusi fallback transaksi->kategori,
// lihat shared/labels/effective-label-subquery.ts & docs/todos/plan/
// general-label.md "Resolusi nilai efektif") -- digabung jadi 1 string
// `GROUP_CONCAT` krn SQLite TIDAK bisa balas array asli lewat
// tauri-plugin-sql; dipecah lagi jadi string[] di
// to-transactions-page-result.ts (split by LABEL_DELIMITER yang sama).
// CASE WHEN (bukan COALESCE 2 subquery terpisah) supaya EXISTS check
// "transaksi punya label eksplisit?" cuma dievaluasi SEKALI -- subquery
// branch yang TIDAK dipilih tidak pernah dieksekusi SQLite (short-circuit
// CASE).
export const EFFECTIVE_LABELS_SUBQUERY = `(
  CASE
    WHEN EXISTS (
      SELECT 1 FROM transaction_labels tl
      WHERE tl.transaction_id = transactions.id AND tl.deleted_at IS NULL
    ) THEN (
      SELECT GROUP_CONCAT(l.name, '${LABEL_DELIMITER}') FROM transaction_labels tl
      JOIN labels l ON l.id = tl.label_id
      WHERE tl.transaction_id = transactions.id AND tl.deleted_at IS NULL AND l.deleted_at IS NULL
    )
    ELSE (
      SELECT GROUP_CONCAT(l.name, '${LABEL_DELIMITER}') FROM category_labels cl
      JOIN labels l ON l.id = cl.label_id
      WHERE cl.category_id = transactions.category_id AND cl.deleted_at IS NULL AND l.deleted_at IS NULL
    )
  END
)`;

export function splitEffectiveLabels(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(LABEL_DELIMITER);
}

/** Transaction hasil query list — punya `has_attachment`/`has_pdf_attachment`/
 * `has_image_attachment` tambahan (dari subquery EXISTS) supaya card list
 * bisa menampilkan indikator lampiran tanpa query terpisah per-item
 * (hindari N+1). SQLite mengembalikan hasil EXISTS sebagai 0/1, bukan
 * boolean. `has_attachment` TETAP mencakup PDF juga (EXISTS atas semua
 * lampiran) — `has_pdf_attachment`/`has_image_attachment` eksplisit
 * terpisah (BUKAN diturunkan dari `has_attachment`) supaya kasus campuran
 * (satu transaksi punya foto DAN pdf) tidak ambigu, UI bisa tampilkan
 * kedua ikon sekaligus. `running_balance` cuma terisi kalau query
 * di-scope ke satu akun (`accountId` diberikan ke `useTransactions`) —
 * lihat `run-transactions-queries.ts`. */
export type TransactionListRow = Transaction & {
  has_attachment: number;
  has_pdf_attachment: number;
  has_image_attachment: number;
  running_balance?: number;
  /** Raw hasil GROUP_CONCAT (lihat EFFECTIVE_LABELS_SUBQUERY) -- JANGAN
   * dipakai langsung di UI, selalu lewat `splitEffectiveLabels()`. */
  effective_labels: string | null;
};
