/**
 * Fragment SQL "label efektif" transaksi -- implementasi resolusi
 * fallback per-scope yang didesain di
 * apps/desktop/docs/todos/plan/general-label.md bagian "Resolusi nilai
 * efektif": transaksi menang kalau punya label eksplisit di scope
 * 'transaction_category'; kalau transaksi KOSONG di scope itu (bukan
 * "tidak match", tapi benar-benar tidak ada baris transaction_labels
 * aktif sama sekali), fallback ke label kategorinya. Murni query-only,
 * TIDAK ada kolom tersimpan/trigger -- konsisten sifat "query-only" label.
 *
 * Dipakai sbg EXISTS subquery (bukan JOIN) supaya 1 transaksi dgn
 * BANYAK label efektif yang match tidak menggandakan baris hasil induk
 * query (pola sama HAS_ATTACHMENT_SUBQUERY, interface.ts).
 *
 * `nameFilter` kosong (string "") berarti "ADA label efektif apa pun"
 * (tanpa peduli namanya) -- dipakai operator "Kosong"/"Tidak kosong" di
 * extract-label-condition.ts. Diisi daftar numbered placeholder SQLite
 * ($N, $N+1, ...) utk match nama spesifik -- dipakai operator "Adalah"/
 * "Bukan". Caller (bukan fungsi ini) yang menambahkan prefix `NOT` di
 * luar utk operator negatif, supaya satu fragment ini tetap satu makna
 * positif ("match kondisi label ini") di semua pemakaian.
 */
export function buildEffectiveLabelSubquery(nameFilter: string): string {
  const nameCondition = nameFilter ? `AND l.name IN (${nameFilter})` : "";
  return `(
    EXISTS (
      SELECT 1 FROM transaction_labels tl
      JOIN labels l ON l.id = tl.label_id
      WHERE tl.transaction_id = transactions.id
        AND tl.deleted_at IS NULL AND l.deleted_at IS NULL
        ${nameCondition}
    )
    OR (
      NOT EXISTS (
        SELECT 1 FROM transaction_labels tl2
        WHERE tl2.transaction_id = transactions.id AND tl2.deleted_at IS NULL
      )
      AND EXISTS (
        SELECT 1 FROM category_labels cl
        JOIN labels l ON l.id = cl.label_id
        WHERE cl.category_id = transactions.category_id
          AND cl.deleted_at IS NULL AND l.deleted_at IS NULL
          ${nameCondition}
      )
    )
  )`;
}
