# rejected-log

Log observability (BUKAN antrian retry) untuk push yang ditolak Worker (`status: "rejected"`, 422 validasi bisnis) — ditulis dari `push-on-write/`, `push-queue/flush-push-queue.ts`, dan `backfill-sync/push-table.ts`, semua titik yang menerima `PushUpsertResult` dengan status `"rejected"`.

## Kenapa ada

Gap ditemukan 2026-10-21 lewat audit konsistensi manual (compare SQLite lokal vs D1 baris per baris): push yang "rejected" TIDAK PERNAH masuk `cloud_sync_queue` (keputusan sadar — payload yang sama akan ditolak lagi tanpa ada yang berubah, retry tidak akan pernah berhasil). Tapi akibatnya baris itu hilang dari cloud TANPA jejak apa pun di desktop — ketahuan hanya lewat compare manual. Root cause kasus 2026-10-21: `debt_accounts.direction` tidak pernah ter-push, bikin 7 transaksi + beberapa `debts`/`debt_payments` ditolak Worker secara silent selama berminggu-minggu sebelum ketahuan.

Tabel ini menutup gap visibility itu — bukan menutup akar masalahnya (itu tugas kode yang push data dengan benar sejak awal).

## `log-rejected-push.ts` / `clear-rejected-log.ts`

Satu baris per `(table_name, row_id)` — reject berulang untuk baris yang sama REPLACE entry lama (reason/timestamp terbaru, bukan histori penuh). `clearRejectedLog` dipanggil begitu push ke baris yang sama SUKSES lagi (`status: "ok"`/`"ignored"`) — entry yang sudah tidak relevan dibersihkan otomatis, bukan menumpuk selamanya.

## `get-rejected-log.ts` / `use-rejected-log.ts`

Dibaca dari halaman Settings → Cloud Sync (`cloud-sync-form.tsx`) — daftar ini murni untuk USER, supaya divergence ketahuan tanpa harus audit manual lagi. TIDAK ada mekanisme otomatis yang bertindak atas isi log ini (sesuai keputusan `push-on-write/README.md`: reject tidak di-retry, user yang harus edit ulang datanya).
