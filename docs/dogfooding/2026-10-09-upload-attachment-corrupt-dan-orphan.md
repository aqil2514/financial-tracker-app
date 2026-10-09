# Lampiran foto rusak setelah upload_attachment, dan jadi orphan setelah transaksi dihapus

Ditemukan saat mencoba lampirkan foto invoice ke sebuah transaksi lewat
MCP server (tool `upload_attachment`). Foto "berhasil" terunggah (tool
membalas `status: ok`), tapi file yang tersimpan di R2 rusak dan tidak
bisa dibuka. Selain itu ditemukan tool `delete_attachment` tidak ada,
dan lampiran tidak ikut terhapus saat transaksi induknya dihapus.

## Bagaimana ketahuan

Kronologi lengkap (waktu WIB, 9 Okt 2026):

1. User kirim foto invoice Biznet (JPEG asli 197.432 byte) untuk
   dilampirkan ke transaksi pengeluaran yang baru dibuat.
2. Karena tool `upload_attachment` cuma terima base64 di parameter (lihat
   [Root cause #4](#4-tidak-ada-jalur-upload-selain-copy-base64-manual-oleh-model)),
   model mengompres & memotong gambar jadi 6.630 byte, lalu menyalin
   ulang base64-nya (8.840 karakter) ke parameter tool secara manual.
3. Upload sukses (`status: ok`). Tapi saat diverifikasi via
   `get_attachment`: file hasil unduhan 6.629 byte (beda 1 byte dari
   yang dikirim), md5 berbeda total dari aslinya, titik beda pertama di
   byte ke-2.848. Pillow gagal membuka file (`broken data stream`).
4. Dicari tool untuk menghapus lampiran yang rusak itu — tidak ada.
5. Transaksi lama dihapus (`delete_transaction`, status ok) dan dicatat
   ulang tanpa lampiran sebagai transaksi baru.
6. `list_attachments` pada ID transaksi **lama** (yang sudah dihapus)
   masih mengembalikan lampiran rusak itu dengan `deletedAt: null` —
   jadi orphan, tidak pernah ikut terhapus.

## Root cause

Lima masalah terpisah, semua terverifikasi di kode (bukan cuma gejala):

### 1. Tidak ada validasi integritas di `upload_attachment`

`apps/mcp-server/src/lib/mcp-tools/attachments/upload-attachment.ts`:
- Baris 12, `MAX_BASE64_LENGTH = 7_000_000` — cuma batas panjang string,
  komentar di baris 6-11 bahkan eksplisit bilang ini bukan validasi
  bisnis presisi, cuma jaga-jaga payload ekstrem.
- Baris 26-30, schema Zod cuma `z.string().min(1).max(...)` — tidak ada
  regex/format check base64.
- Baris 39, `Buffer.from(imageBase64, "base64")` — decode langsung ke
  Buffer, lalu tanpa pengecekan apa pun bytes itu dibungkus `Blob`
  (baris 43) dan dikirim ke Worker.

Base64 decoder tidak tahu (dan tidak peduli) isi semantik JPEG — kalau
1 karakter base64 yang disalin ulang oleh model berubah/hilang, hasil
decode tetap "berhasil" secara teknis, cuma isinya korup. Tidak ada cek
magic bytes JPEG (SOI `FFD8`/EOI `FFD9`), tidak ada decode-image, tidak
ada parameter `expectedSize`/`expectedHash` untuk dibandingkan.

### 2. Jalur Worker → R2 tidak menambah corruption baru (sudah dicek, aman)

Ditelusuri sampai `apps/worker/src/modules/attachments/service.ts`
baris 53-55 (`ATTACHMENTS_BUCKET.put(r2Key, input.bytes, ...)`) — bytes
diteruskan apa adanya dari `FormData`/`ArrayBuffer`
(`apps/worker/src/modules/attachments/controller.ts` baris 34), tidak
ada decode/encode ulang base64 di jalur ini. Jadi titik corruption
hanya ada satu: decode base64 pertama (dan satu-satunya) di
`upload-attachment.ts:39` — konsisten dengan dugaan di laporan awal
bahwa 1 byte hilang/berubah saat model menyalin ulang teks base64
sepanjang 8.840 karakter secara manual.

### 3. `deleted_at IS NULL` tidak pernah tereksekusi untuk attachment

`apps/worker/schema/0003_transaction_attachments.sql` baris 39
mendefinisikan `transaction_id ... REFERENCES transactions(id) ON
DELETE CASCADE`, dengan catatan eksplisit di baris 31-35 bahwa CASCADE
ini cuma untuk row D1, bukan object fisik R2 (itu harus ditangani
manual di modul Worker).

Tapi `deleteTransaction` di
`apps/worker/src/modules/transactions/service.ts` baris 612-639 memakai
**soft delete** (`UPDATE transactions SET deleted_at = ...`), bukan
`DELETE FROM transactions`. FK `ON DELETE CASCADE` hanya terpicu oleh
hard DELETE SQL — jadi constraint itu tidak pernah jalan di alur
normal. Fungsi ini juga sudah punya pola `detachXForDeletedTransaction`
untuk debt (baris 622), investment purchase (baris 628), dan investment
sale (baris 631) — tapi **tidak ada** `detachAttachmentForDeletedTransaction`
sejenis yang dipanggil. Row `transaction_attachments` tetap
`deleted_at IS NULL` selamanya setelah transaksi induknya dihapus.

### 4. Tidak ada jalur upload selain copy base64 manual oleh model

`apps/mcp-server/src/lib/mcp-tools/attachments/upload-attachment.ts`
baris 24-34 — parameter cuma `transactionId`, `imageBase64` (string
base64 mentah), `mimeType`. Tidak ada opsi path file lokal atau URL
pre-signed. Satu-satunya cara masukkan gambar lewat MCP adalah model
menyalin ulang seluruh isi base64 karakter demi karakter ke parameter
tool call — ini sendiri yang rawan menyebabkan masalah #1 di atas.

(Ada `save_attachment_from_path` di
`apps/desktop/src-tauri/src/attachments/mod.rs` baris 72 yang baca
langsung dari filesystem, tapi itu jalur Tauri desktop app, tidak bisa
dipanggil lewat MCP.)

### 5. Tool `delete_attachment` tidak pernah dijembatani ke MCP

Endpoint Worker-nya **sudah ada dan lengkap**:
- Route: `apps/worker/src/modules/attachments/router.ts` baris 17,
  `DELETE /:id`.
- Service: `apps/worker/src/modules/attachments/service.ts` baris
  180-196, `deleteAttachment` — hard-delete object R2 (baris 188) +
  soft-delete row D1 (baris 191-193).

Tapi `apps/mcp-server/src/lib/mcp-tools/attachments/index.ts` baris
1-10 cuma mendaftarkan `registerUploadAttachment`,
`registerGetAttachment`, `registerListAttachments` — tidak ada
`registerDeleteAttachment`. Endpoint Worker-nya nganggur, tidak ada
tool MCP yang memanggilnya.

## Skema tabel (referensi)

`apps/worker/schema/0003_transaction_attachments.sql` baris 37-49 —
kolom yang ada: `id`, `transaction_id`, `r2_key`, `content_type`,
`size_bytes`, `created_at`, `updated_at`, `deleted_at`, `sync_source`.
Tidak ada kolom checksum/hash apa pun — `size_bytes` murni derived dari
byte yang diterima (yang berpotensi sudah korup), bukan nilai
independen untuk verifikasi.

## Status

Sebagian sudah di-fix (4 dari 5 temuan):

1. **Tool `delete_attachment` (MCP) -- fixed.** Endpoint Worker `DELETE
   /attachments/:id` yang sudah ada sejak awal sekarang dijembatani ke
   tool MCP baru di
   `apps/mcp-server/src/lib/mcp-tools/attachments/delete-attachment.ts`,
   didaftarkan di `attachments/index.ts`. Pola sama `delete_transaction`
   (wajib `confirm: true`).
2. **Attachment orphan setelah transaksi dihapus -- fixed.** Tambah
   `detachAttachmentsForDeletedTransaction` di
   `apps/worker/src/modules/attachments/service.ts` (query semua
   attachment milik transaksi, reuse `deleteAttachment` per-row supaya
   object R2 ikut hard-delete, bukan cuma soft-delete D1), dipanggil
   dari `deleteTransaction` di `transactions/service.ts` sejajar
   `detachInvestmentPurchaseForDeletedTransaction`/
   `detachInvestmentSaleForDeletedTransaction`. Tidak perlu migrasi
   skema baru karena `deleted_at` sudah ada.
3. **Tidak ada validasi integritas di upload -- partial fix.** Tambah
   cek magic bytes (SOI+EOI utk JPEG, signature PNG, marker RIFF/WEBP
   utk WEBP) di `upload-attachment.ts` sebelum bytes dikirim ke Worker
   -- menolak dgn pesan jelas kalau tidak cocok. **Catatan penting:**
   ini cuma cek awal+akhir file, BUKAN decode gambar penuh -- byte yang
   beda di TENGAH file (seperti kasus asli, beda di byte ke-2.848) TIDAK
   akan tertangkap oleh cek ini. Mencegah kelas error yang lebih umum
   (truncation/prefix hilang), bukan semua kemungkinan corruption.
   `image/heic` tidak dicek (tidak punya magic bytes sesederhana itu).
4. **Checksum (SHA-256) di request+response upload -- fixed.** Migrasi
   baru `apps/worker/schema/0004_transaction_attachments_checksum.sql`
   (kolom `checksum_sha256`, nullable, TIDAK backfill baris lama --
   sudah diterapkan ke D1 remote production via `wrangler d1 execute
   --remote` 2026-10-09). `uploadAttachment`
   (`apps/worker/src/modules/attachments/service.ts`) menghitung
   SHA-256 dari bytes yang sama yang di-put ke R2 (pakai `crypto.subtle`
   native Workers runtime), simpan ke kolom baru, kembalikan di response
   upload. Tool MCP `upload_attachment` menghitung checksum lokal dari
   bytes yang ia kirim sendiri, bandingkan dengan `checksumSha256` yang
   dibalas Worker -- kalau beda, lempar error eksplisit (tidak
   auto-delete) supaya caller tahu harus `delete_attachment` lalu
   upload ulang. Ini menutup celah corruption di TENGAH file (kasus
   asli, beda di byte ke-2.848) yang tidak tertangkap magic-byte check
   di fix #3 -- checksum dihitung dari seluruh byte, bukan cuma
   prefix/suffix.

Belum di-fix (1 dari 5 temuan, scope desain baru di luar perbaikan
reaktif ini):

5. **Tidak ada jalur upload selain copy base64 manual oleh model** --
   butuh desain baru (URL pre-signed / jalur lain), dicatat sebagai
   temuan tapi belum digarap.

Data referensi dari laporan asli (akun dogfooding, bukan data nyata
yang perlu ditindaklanjuti — transaksi lama sudah dihapus, transaksi
baru sudah dicatat ulang tanpa lampiran):
- Transaksi lama (dihapus): `01a11dd8-f469-7593-b22a-74f121b638b2`
- Lampiran rusak (orphan, masih ada di R2+D1):
  `01a11de9-38e6-7b07-9bdd-3a5d5aa600a7`, image/jpeg, 6.629 byte
