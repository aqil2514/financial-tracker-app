import type { Transaction } from "@/lib/db";

export const HAS_ATTACHMENT_SUBQUERY =
  "EXISTS (SELECT 1 FROM transaction_attachments WHERE transaction_attachments.transaction_id = transactions.id)";

/** Transaction hasil query list — punya `has_attachment` tambahan (dari
 * subquery EXISTS) supaya card list bisa menampilkan indikator lampiran
 * tanpa query terpisah per-item (hindari N+1). SQLite mengembalikan hasil
 * EXISTS sebagai 0/1, bukan boolean. */
export type TransactionListRow = Transaction & { has_attachment: number };
