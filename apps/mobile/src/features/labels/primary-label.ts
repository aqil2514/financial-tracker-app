// Satu label efektif per transaksi: milik transaksi sendiri, kalau kosong label kategorinya, lalu diambil yang
// namanya paling awal secara alfabet. Sama dengan apps/desktop/src/shared/labels/primary-label-subquery.ts.
//
// Hanya SATU label, bukan semua, karena breakdown cashflow harus berjumlah pas dengan total pemasukan/pengeluaran.
// Transaksi multi-label yang dihitung penuh di tiap labelnya akan melebihi total. Konsekuensinya label kedua dst
// tidak terlihat di laporan ini; filter Label di daftar transaksi menampilkan semuanya.
//
// `alias` = nama/alias tabel transaksi di query pemanggil ("transactions" kalau tanpa alias).
export function primaryLabelSql(alias: string) {
  return `(
    CASE
      WHEN EXISTS (SELECT 1 FROM transaction_labels tl WHERE tl.transaction_id = ${alias}.id) THEN (
        SELECT MIN(l.name) FROM transaction_labels tl
        JOIN labels l ON l.id = tl.label_id
        WHERE tl.transaction_id = ${alias}.id
      )
      ELSE (
        SELECT MIN(l.name) FROM category_labels cl
        JOIN labels l ON l.id = cl.label_id
        WHERE cl.category_id = ${alias}.category_id
      )
    END
  )`;
}
