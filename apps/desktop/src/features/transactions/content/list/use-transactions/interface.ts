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
};
