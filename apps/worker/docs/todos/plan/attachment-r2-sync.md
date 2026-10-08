# Sinkronisasi Lampiran Transaksi via R2

## Status & TODO saat ini (ringkas)

Penjelasan lengkap kenapa tiap poin ada di sini — lihat bagian "Latar belakang" dan "Keputusan desain" di bawah.

- [ ] Keputusan skema belum final: kolom baru di `transaction_attachments` (lokal) dan tabel sync-nya di D1 (`storage_type`/`r2_key` vs `file_path` lokal).
- [ ] Tambah binding `[[r2_buckets]]` di `apps/worker/wrangler.toml` + update `Env` di `shared/env.ts`.
- [ ] Modul baru `apps/worker/src/modules/attachments/` (router/controller/service/schema) — ikuti pola di [docs/rules/module-structure.md](../../rules/module-structure.md).
- [ ] Endpoint upload (dari HP/MCP langsung ke R2 via Worker) dan endpoint baca/list.
- [ ] Endpoint delete — harus hapus row D1 (soft-delete, ikut pola LWW yang sudah ada) DAN object R2 (hard delete, R2 tidak punya konsep soft-delete sendiri).
- [ ] Migrasi desktop: kolom baru di SQLite lokal buat tandai "attachment ini sudah ada salinan di R2" + path lokal vs key R2 dibedakan di UI (thumbnail, detail dialog).
- [ ] Tool MCP baru untuk baca/attach lampiran dari sisi Asisten AI (upload dari HP → tercatat ke transaksi).
- [ ] Keputusan: siapa yang BOLEH upload langsung ke R2 — lewat Worker endpoint saja, atau desktop juga push attachment lama yang masih di disk lokal?
- [ ] Rencana migrasi lampiran LAMA yang sudah ada di disk lokal (opsional naik ke R2, atau tetap lokal selamanya).

## Latar belakang

Trigger konkret (2026-10-08): user beli obat-obatan sawah, foto struk dari HP, ingin itu tercatat sebagai lampiran transaksi DAN bisa dibaca Asisten AI (Claude) via MCP — misalnya untuk ekstrak nominal/item dari foto secara otomatis.

Kondisi saat ini TIDAK mendukung ini:

- Lampiran transaksi di desktop disimpan sebagai file fisik di disk lokal PC (app data dir atau folder custom user) — lihat `apps/desktop/src-tauri/src/attachments/mod.rs`. Hanya path-nya yang dicatat di SQLite (`transaction_attachments.file_path`, lihat `apps/desktop/src-tauri/migrations/0010_transaction_attachments.sql`).
- Cloud sync (`apps/worker`) saat ini HANYA mensinkronkan data (transactions, accounts, account_groups, categories, contacts, debts, debt_payments) — lihat `apps/worker/docs/todos/done/cloud-sync.md`. File lampiran tidak pernah ikut sync ke mana pun.
- MCP server baca/tulis data lewat Worker (D1), tidak pernah menyentuh file lampiran.
- Worker (`apps/worker/wrangler.toml`) saat ini hanya punya binding D1 (`DB`) — belum ada binding R2 sama sekali.

Akibatnya: foto yang diambil dari HP tidak punya jalur masuk ke aplikasi sama sekali selain manual transfer file ke PC lalu attach manual lewat desktop — dan bahkan setelah itu, Claude/MCP tetap tidak bisa membacanya karena cuma path lokal PC.

## Kenapa ini BUKAN sekadar nambah binding R2

Dibahas sebelumnya (lihat riwayat chat) — nambah R2 doang tidak otomatis selesai, karena beda kelas masalah dari sync data yang sudah ada:

1. **LWW itu row-level, bukan blob-level.** LWW (`updated_at` string lexicographic, lihat `apps/worker/src/shared/lww.ts`) menyelesaikan "siapa menang kalau dua sisi edit row yang sama". Tapi isi FILE lampiran itu sendiri bukan kolom yang bisa di-LWW — begitu upload ke R2, objectnya immutable (upload baru = object baru, bukan "update" yang head-to-head dibandingkan `updated_at`).
2. **`file_path` sekarang menyimpan path lokal Windows** (`C:\Users\...`), tidak bermakna kalau disinkron ke cloud apa adanya. Perlu kolom pembeda (`storage_type`: `local` | `r2`, dan `r2_key` terpisah dari `file_path`) supaya desktop tahu cara ambil file yang benar (baca disk lokal vs fetch dari R2 lewat Worker).
3. **Siapa penulis sumber kebenaran untuk upload baru dari HP?** Kalau foto diambil dari HP lewat Claude/MCP langsung ke R2, row `transaction_attachments` yang mewakilinya harus muncul juga di SQLite lokal PC lewat sync turun — desktop perlu render thumbnail dari R2 (bukan baca disk lokal) untuk row jenis ini.
4. **Soft-delete dua lapis.** Hapus row via LWW (soft-delete, pola yang sudah ada di semua tabel sync) gampang, tapi object fisik di R2 harus dihapus terpisah — mirip pola `delete_attachment_file` yang sudah ada di desktop untuk disk lokal (`apps/desktop/src-tauri/src/attachments/mod.rs:115`), perlu versi Worker-nya untuk R2.

## Keputusan desain (DRAFT — belum final)

### Skema data

Tabel `transaction_attachments` (baik lokal SQLite maupun replika D1) perlu kolom tambahan:

- `storage_type` (`local` | `r2`) — menentukan cara desktop membaca file: disk lokal langsung, atau fetch dari Worker/R2.
- `r2_key` (nullable) — key object di R2, diisi hanya kalau `storage_type = 'r2'`. `file_path` tetap dipakai untuk `storage_type = 'local'`.

Perlu migrasi baru di `apps/desktop/src-tauri/migrations/` (ingat: WAJIB register manual di `migrations.rs`, lihat memory `feedback_migration_rs_registration`) dan skema setara di `apps/worker/schema/`.

### Modul Worker baru: `attachments`

Ikuti pola router/controller/service/schema (lihat `module-structure.md`). Modul PEMILIK tabel `transaction_attachments` di sisi Worker — endpoint minimal:

- `POST /attachments` — upload binary ke R2 + insert row D1 (dipakai MCP tool upload-dari-HP, dan dipakai desktop kalau nanti mau push lampiran lama ke cloud).
- `GET /attachments/:id` — stream/redirect ke isi file dari R2 (dipakai desktop utk render thumbnail/preview lampiran yg `storage_type = 'r2'`, dan dipakai MCP/Claude utk "membaca" gambar).
- `DELETE /attachments/:id` — soft-delete row D1 (pola LWW yang sama dengan tabel lain) SEKALIGUS hard-delete object R2 (R2 tidak punya soft-delete).

Autentikasi ikut pola `requireAuth` yang sudah ada di modul lain.

### Tool MCP baru

Setidaknya satu tool baru di `apps/mcp-server` untuk "upload foto dari HP sebagai lampiran transaksi" (menerima gambar, panggil `POST /attachments` Worker, kaitkan ke `transaction_id`). Tool baca lampiran (`get_investment_detail`-style) juga perlu bisa mengembalikan isi gambar supaya Claude benar-benar bisa "melihat" strukturnya, bukan cuma metadata.

### Yang BELUM diputuskan (butuh diskusi lanjutan)

- Apakah lampiran LAMA yang sudah di disk lokal PC perlu migrasi naik ke R2, atau dibiarkan `storage_type = 'local'` selamanya (hanya lampiran baru dari HP yang masuk R2)?
- Kuota/limit ukuran upload per foto, dan retensi (apakah ada pembersihan R2 untuk attachment yang row-nya sudah soft-deleted lama)?
- Biaya: R2 gratis sampai 10GB + operasi tertentu per bulan — perlu dipantau kalau volume lampiran mulai signifikan (relevan dgn [[project_worker_dev_prod_isolation]] soal 1 Worker shared dev/prod).
