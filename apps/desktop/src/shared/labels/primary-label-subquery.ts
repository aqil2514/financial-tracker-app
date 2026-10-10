/**
 * Fragment SQL "label efektif TUNGGAL" transaksi -- varian skalar dari
 * EFFECTIVE_LABELS_SUBQUERY (use-transactions/interface.ts), dipakai
 * breakdown cashflow per label. Resolusi fallback transaksi->kategori
 * SAMA PERSIS (transaksi menang kalau punya label eksplisit; kalau
 * benar-benar kosong, pakai label kategorinya), bedanya hanya di sini
 * memakai MIN(l.name) alih-alih GROUP_CONCAT.
 *
 * Kenapa MIN (1 label saja, urut alfabetis) dan bukan semua label:
 * breakdown cashflow dibaca sbg angka yang HARUS BERJUMLAH PAS dengan
 * total pemasukan/pengeluaran. Kalau transaksi multi-label dihitung
 * penuh di tiap labelnya (pola aggregate-by-label.ts di halaman
 * Investasi), SUM lintas baris akan melebihi total sungguhan -- bisa
 * diterima di sana (P/L per jenis instrumen, dibaca sbg irisan yg
 * memang boleh tumpang tindih), TIDAK di sini. Konsekuensi yang
 * disengaja: label kedua dst milik satu transaksi tidak terlihat di
 * laporan ini (keputusan 2026-10-10) -- pakai filter label di daftar
 * transaksi kalau butuh melihat semua labelnya.
 *
 * `alias` WAJIB diisi nama alias tabel transaksi di query pemanggil
 * (mis. "t" utk `FROM transactions t`), atau "transactions" kalau query
 * itu tidak memakai alias. Tidak bisa selalu memakai nama tabel penuh
 * spt 2 fragment label lain: begitu query induk menulis
 * `FROM transactions t`, nama `transactions` TIDAK lagi dikenal SQLite
 * ("no such column: transactions.id") -- fragment lama aman cuma karena
 * query daftar transaksi kebetulan tidak beralias.
 */
export function buildPrimaryEffectiveLabelSubquery(alias: string): string {
  return `(
    CASE
      WHEN EXISTS (
        SELECT 1 FROM transaction_labels tl
        WHERE tl.transaction_id = ${alias}.id AND tl.deleted_at IS NULL
      ) THEN (
        SELECT MIN(l.name) FROM transaction_labels tl
        JOIN labels l ON l.id = tl.label_id
        WHERE tl.transaction_id = ${alias}.id AND tl.deleted_at IS NULL AND l.deleted_at IS NULL
      )
      ELSE (
        SELECT MIN(l.name) FROM category_labels cl
        JOIN labels l ON l.id = cl.label_id
        WHERE cl.category_id = ${alias}.category_id AND cl.deleted_at IS NULL AND l.deleted_at IS NULL
      )
    END
  )`;
}
