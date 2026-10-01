-- Lanjutan 0029_cloud_sync_queue.sql -- tambah kolom `payload` (JSON,
-- nullable) utk op='delete'.
--
-- NULL utk op='upsert' (row dibaca ULANG dari tabelnya sendiri saat
-- retry, lihat shared/cloud-sync/push-queue.ts). WAJIB terisi utk
-- op='delete' -- payload action reassign/unassign (mis.
-- {"transactionAction":"reassign","targetAccountId":"..."}) adalah
-- keputusan SESAAT user saat klik delete, bukan state yang bisa dibaca
-- ulang dari row (row sudah hard-deleted lokal di titik itu). Tanpa
-- ini, retry delete yang gagal akan push TANPA action ke Worker -- row
-- ter-soft-delete di D1 tapi relasinya (transaksi/sub-kategori) tetap
-- merujuk id yang sudah dihapus, beda dari yang terjadi di PC.

ALTER TABLE cloud_sync_queue ADD COLUMN payload TEXT;
