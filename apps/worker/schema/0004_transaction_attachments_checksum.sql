-- Tambah kolom checksum (SHA-256, hex lowercase) ke transaction_attachments
-- -- dipicu temuan dogfooding 2026-10-09
-- (docs/dogfooding/2026-10-09-upload-attachment-corrupt-dan-orphan.md):
-- upload_attachment menerima base64 yang sudah korup (1 byte berubah di
-- TENGAH file saat model LLM menyalin ulang teks base64 secara manual),
-- tapi tool balas status "ok" krn tidak ada apa pun yang memverifikasi
-- integritas isi file. Magic-byte check (lihat upload-attachment.ts)
-- cuma menutup kasus truncation di awal/akhir file -- byte yang beda di
-- tengah TIDAK akan ketahuan tanpa checksum penuh.
--
-- Nullable krn baris lama (upload sebelum migrasi ini) tidak punya nilai
-- -- TIDAK di-backfill retroaktif (tidak ada cara hitung ulang checksum
-- tanpa re-download+rehash tiap object R2 yang ada, di luar scope fix
-- ini). Baris baru SELALU diisi oleh Worker saat uploadAttachment.

ALTER TABLE transaction_attachments ADD COLUMN checksum_sha256 TEXT;
