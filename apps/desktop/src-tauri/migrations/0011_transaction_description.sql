-- Kolom deskripsi detail transaksi, terpisah dari `note` (judul/ringkasan
-- singkat). Disimpan sebagai TEXT berisi JSON dokumen Tiptap — dirender
-- rich text di UI, bukan plain string. Nullable: transaksi lama (termasuk
-- hasil import Money Manager sebelumnya) tidak diisi ulang otomatis.
ALTER TABLE transactions ADD COLUMN description TEXT;
