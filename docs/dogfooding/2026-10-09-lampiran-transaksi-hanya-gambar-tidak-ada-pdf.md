# Lampiran transaksi cuma menerima gambar — tidak ada jalur untuk PDF invoice

Ditemukan saat mengecek transaksi perpanjangan VPS Biznet (dua transaksi:
"Perpanjang VPS Biznet NEO Lite (Retailku), Inv 717525" dan "Vps Biznet"
sebelumnya) — keduanya **tidak punya lampiran sama sekali**
(`list_attachments` via MCP mengembalikan array kosong untuk keduanya).
Invoice dari Biznet secara riil dikirim sebagai **PDF**, tapi sistem
lampiran saat ini tidak punya jalur untuk itu.

## Root cause

Dicek di kode (`apps/desktop/src/shared/attachments/use-attachment-capture.ts`)
— pembatasan ke gambar diterapkan KETAT di tiga jalur input sekaligus,
bukan cuma label UI:

- **Dialog pilih file** (`handlePickFile`, baris 100-109) — filter OS
  eksplisit `extensions: IMAGE_EXTENSIONS` (`png`, `jpg`, `jpeg`,
  `webp`, `gif`, baris 11). File PDF tidak akan muncul di dialog sama
  sekali.
- **Drag & drop** (baris 83-89) — path yang di-drop difilter ulang
  dengan ekstensi yang sama; kalau tidak cocok, toast error eksplisit
  "File yang di-drop bukan gambar".
- **Paste clipboard** (`handlePaste`, baris 111-140) — hanya menerima
  `item.type.startsWith("image/")`, dan `readImage()` dari
  `@tauri-apps/plugin-clipboard-manager` cuma baca data bitmap gambar.

Di sisi MCP (`apps/mcp-server/src/lib/mcp-tools/attachments/upload-attachment.ts`),
lihat juga [2026-10-09-upload-attachment-corrupt-dan-orphan.md](2026-10-09-upload-attachment-corrupt-dan-orphan.md)
fix #3 — validasi magic-bytes yang baru ditambahkan HANYA mengenali
signature JPEG/PNG/WEBP, jadi walau jalur MCP tidak py filter ekstensi
seketat desktop, PDF akan ditolak juga di titik ini (magic bytes PDF
`%PDF` tidak dikenali).

## Yang SUDAH memungkinkan (dicek di skema, bukan diasumsikan)

Skema tabel `transaction_attachments` (baik desktop `migrations/`
maupun Worker `apps/worker/schema/0003_transaction_attachments.sql`)
**tidak membatasi tipe file di level database** — kolom `content_type`
generik (TEXT, bukan CHECK constraint berisi daftar MIME image). Jadi
pembatasan ke gambar murni ada di LAPISAN VALIDASI APLIKASI (file
picker, magic-byte check), bukan struktural di skema. Menambah
dukungan PDF tidak butuh migrasi skema apa pun — murni perubahan di
titik validasi.

## Keputusan scope (2026-10-09)

Cakupan tipe file tambahan **dibatasi ke PDF saja** — bukan dokumen
Office (`.docx`/`.xlsx`) atau tipe lain. Alasan: dokumen Office lebih
natural dikonversi dulu ke PDF oleh user sebelum dilampirkan (sudah
jadi kebiasaan umum untuk kirim invoice/struk), jadi menambah dukungan
tipe Office langsung berisiko scope creep tanpa kebutuhan nyata yang
terbukti — beda dari PDF yang sudah ada kasus konkret (invoice VPS
Biznet).

## Pertanyaan yang belum dijawab (bukan bug, ini observasi untuk didiskusikan)

- Apakah PDF cukup ditambahkan ke daftar ekstensi/filter yang sudah
  ada (`IMAGE_EXTENSIONS` semacamnya diperluas atau dipisah jadi
  kategori baru), atau butuh UI/komponen thumbnail terpisah
  (`AttachmentThumbnail` saat ini kemungkinan mengasumsikan bisa
  dirender sebagai `<img>`, PDF butuh preview/ikon berbeda — BELUM
  dicek kodenya, perlu ditelusuri sebelum implementasi).
