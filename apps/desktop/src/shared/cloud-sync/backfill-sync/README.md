# backfill-sync

Backfill manual: push SEMUA data lokal existing ke Worker, sekali jalan — dipicu tombol "Sync Semua Data Sekarang" di Settings (lihat `docs/todos/plan/mcp-server-cloud-mirror.md`, bagian ditambah 2026-10-01).

## Kenapa ini perlu

`push-on-write.ts` cuma mengirim baris yang DITULIS SETELAH fitur itu aktif — data yang sudah lama ada di SQLite lokal SEBELUM toggle ON tidak pernah otomatis ter-push. Begitu user bikin transaksi baru yang merujuk akun LAMA (belum pernah ter-push), Worker menolak dengan FOREIGN KEY constraint (akun itu belum ada di D1) — ditemukan nyata saat verifikasi end-to-end 2026-10-01, bukan dugaan.

## Urutan push (lihat `backfill-order.ts`)

WAJIB ikut dependency FK — sama seperti `pull-sync/` tapi arah terbalik: `account_groups` dulu (tidak referensi apa pun), lalu `categories`+`contacts` (independen satu sama lain), baru `accounts` (referensi `account_groups`), baru `transactions` (referensi ketiganya).

`debts`/`debt_payments` TIDAK di-push di sini (SENGAJA SKIP, sama seperti `push-on-write` — tidak ada endpoint POST langsung di Worker, lihat catatan di `worker-client.ts`).

`transaction_attachments` di-push PALING AKHIR (setelah `transactions`, referensi FK-nya) — ini sekaligus jawaban eksekusi untuk open question "migrasi lampiran lama ke R2" di `attachment-r2-sync.md`: backfill reuse `pushRowPayload` case `transaction_attachments` yang SAMA dengan push-on-write biasa (baca ulang `file_path` dari disk + upload), jadi tidak perlu jalur terpisah — cukup tombol yang sama, sekali jalan, mengirim SEMUA lampiran lokal (baru maupun lama) yang belum pernah ter-push.

## Bug ditemukan saat verifikasi production 2026-10-01: categories self-referencing

`categories` SELF-REFERENCING (`parent_id -> categories.id`) — `SELECT id FROM categories` TIDAK menjamin induk terkirim sebelum anaknya, jadi sub-kategori yang kebetulan ter-push duluan ditolak Worker (FK constraint), efek domino ke transaksi yang pakai kategori itu.

Perbaikannya ada di `get-category-ids-parents-first.ts`. Diverifikasi di data nyata: hierarki cuma 2 LEVEL (tidak ada grandparent), jadi cukup push `parent_id IS NULL` dulu baru `parent_id IS NOT NULL` — BUKAN solusi umum N-level, tapi cukup untuk data yang ada sekarang.

## Soft-delete

TIDAK soft-deleted (`deleted_at IS NULL` difilter di level WHERE lokal) — baris yang sudah dihapus di PC tidak perlu di-backfill (desktop 100% hard-delete, baris itu sudah tidak ada sama sekali).

## Error handling

Best-effort per baris (`push-table.ts`) — satu baris gagal TIDAK menghentikan sisanya, supaya satu transaksi bermasalah tidak memblokir ratusan baris lain yang valid. Caller (UI tombol) dapat callback progress untuk ditampilkan real-time.
