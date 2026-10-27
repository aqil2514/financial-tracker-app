# Tabel `transaction_attachments`

Menyimpan metadata lampiran transaksi (foto struk dkk) yang isi filenya disimpan di **Cloudflare R2**, bukan di D1 — tabel ini cuma pointer + metadata. Dibuat di `schema/0003_transaction_attachments.sql` sebagai tahap skema dari `docs/todos/done/attachment-r2-sync.md`, lalu dapat kolom `checksum_sha256` di `schema/0004_transaction_attachments_checksum.sql` (dipicu temuan dogfooding korupsi upload, lihat `docs/dogfooding/2026-10-09-upload-attachment-corrupt-dan-orphan.md`).

Ini tabel yang STRUKTURNYA PALING BEDA dari versi desktop di antara ketiganya — desktop simpan path file lokal device (`file_path`), sedangkan worker simpan referensi ke object storage cloud. Lihat Catatan untuk daftar lengkap bedanya.

## SQL final

```sql
CREATE TABLE transaction_attachments (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    r2_key TEXT NOT NULL,
    content_type TEXT,
    size_bytes INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    checksum_sha256 TEXT
);

CREATE INDEX idx_transaction_attachments_transaction ON transaction_attachments(transaction_id);
CREATE UNIQUE INDEX idx_transaction_attachments_r2_key ON transaction_attachments(r2_key);
```

## Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID v7. WAJIB sama persis dengan `id` baris attachment terkait di SQLite lokal desktop (diverifikasi format UUID v7 pada database production, cek manual 2026-10-08) — ini kunci penghubung lintas device, BUKAN `r2_key`. |
| `transaction_id` | TEXT | ya | - | FK ke `transactions(id)`. `ON DELETE CASCADE` — menghapus baris D1 ikut menghapus baris lampiran di D1, tapi lihat Catatan soal object R2-nya. |
| `r2_key` | TEXT | ya | - | Satu-satunya penunjuk lokasi object fisik di R2, dibuat worker saat upload dengan format `{transaction_id}/{id}.{ext}` (ekstensi diturunkan dari `content_type`, fallback `bin`). Bukan sama dengan `id`. |
| `content_type` | TEXT | tidak | NULL | MIME type file, dipakai endpoint `GET /attachments/:id` untuk header `Content-Type` saat serve dari R2. Tidak ada di skema desktop — desktop baca langsung dari ekstensi file di disk, tidak perlu ini. |
| `size_bytes` | INTEGER | tidak | NULL | Ukuran file dalam byte, untuk cek kuota/estimasi biaya tanpa query R2. Tidak ada di skema desktop. |
| `created_at` | TEXT | ya | - | Waktu baris dibuat. Tidak ada DEFAULT di D1 (beda dari pola desktop) — worker selalu isi eksplisit saat upload. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris diubah. Dasar LWW untuk resolusi konflik. Kolom sinkronisasi — TIDAK ADA di skema desktop sama sekali (desktop tidak replikasi row attachment lintas device lewat kolom ini). |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker. Kolom sinkronisasi — TIDAK ADA di skema desktop. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp`, menandai asal penulis terakhir. Kolom sinkronisasi — TIDAK ADA di skema desktop. |
| `checksum_sha256` | TEXT | tidak | NULL | Hash SHA-256 (hex lowercase) dari bytes yang benar-benar disimpan ke R2, dibalas ke caller untuk verifikasi integritas file. Nullable karena baris lama (upload sebelum migrasi `0004`) tidak punya nilai dan tidak di-backfill retroaktif. Tidak ada di skema desktop. |

## Catatan

- **Beda struktural dari desktop, bukan cuma tambahan kolom**: desktop (`apps/desktop/docs/tables/transaction-attachment.md`) menyimpan `file_path` — path file di storage lokal device, device-spesifik, tidak bermakna direplikasi ke cloud. Worker justru TIDAK PUNYA kolom `file_path` sama sekali; sebagai gantinya dia menyimpan `r2_key` yang menunjuk ke object di Cloudflare R2 (binding `env.ATTACHMENTS_BUCKET`). Device mana pun (PC lama, PC baru, nanti `apps/mobile`) menerjemahkan `id` baris ini menjadi bytes file lewat endpoint worker (`GET /attachments/:id`), lalu menyimpannya sendiri ke path lokal masing-masing — worker tidak tahu dan tidak peduli path lokal device mana pun.
- `idx_transaction_attachments_r2_key` adalah **UNIQUE index** pada `r2_key` — satu object R2 cuma boleh terpasang ke satu baris attachment, mencegah dua baris metadata menunjuk ke file fisik yang sama.
- **Tidak ada trigger di D1** (terverifikasi, `sqlite_master` kosong untuk `type='trigger'`) — `updated_at` diisi eksplisit oleh `src/modules/attachments/service.ts` (`uploadAttachment`, `deleteAttachment`) tiap INSERT/UPDATE, sama seperti semua tabel lain di worker.
- **Soft-delete attachment TIDAK simetris dengan tabel lain**: `deleteAttachment` menyetel `deleted_at` di D1 SEKALIGUS hard-delete object fisik di R2 (`env.ATTACHMENTS_BUCKET.delete`). Beda dari tabel lain yang baris soft-deleted masih bisa "hidup lagi" kalau sisi lain melakukan edit dengan `updated_at` lebih baru (menang lewat LWW) — attachment yang sudah dihapus TIDAK bisa hidup lagi karena bytes-nya sudah benar-benar hilang dari R2, bukan cuma ditandai.
- `ON DELETE CASCADE` dari `transactions` hanya menghapus baris D1 — TIDAK ikut menghapus object fisik R2, karena D1 tidak bisa memicu side-effect ke binding R2 lewat FK. Hard-delete object R2 saat transaksi induk dihapus ditangani eksplisit lewat `detachAttachmentsForDeletedTransaction` (dipanggil dari `transactions/service.ts`), yang memanggil `deleteAttachment` per baris alih-alih `UPDATE` massal, supaya tiap object R2 ikut terhapus satu per satu.
- Urutan tulis saat upload sengaja R2 dulu baru baris D1 (lihat `uploadAttachment`) — row D1 yang orphan tanpa object R2 dianggap lebih buruk daripada object R2 tanpa row (yang masih bisa dibersihkan belakangan).
- `checksum_sha256` muncul sebagai respons ke temuan dogfooding: tanpa ini, korupsi 1 byte di tengah file (mis. saat LLM menyalin ulang base64 secara manual) tidak terdeteksi oleh magic-byte check saja.
- Lihat juga [transaction.md](transaction.md) untuk tabel induknya.
