# push-retailku-sync

Push baris `transactions` hasil sync Retailku ke Worker — dipanggil `syncAll()` SETELAH sync sukses (all-or-nothing, jadi tidak ada baris yang nanti di-rollback). Tanpa ini baris `source='retailku_sync'` cuma sampai cloud lewat backfill manual, karena insert-nya bukan lewat hook form (tempat `pushOnWrite` biasa dipanggil). Lihat `docs/todos/plan/cloud-sync-retailku-provenance-gap.md`.

## `debts`/`debt_payments` Retailku TIDAK ikut

Worker belum punya endpoint push untuk keduanya (diturunkan dari transaksi di sisi Worker).

## Push berurutan, bukan `Promise.all`

Satu sync bisa ratusan baris — jangan banjiri Worker dengan request paralel. `pushOnWrite` sendiri sudah fallback ke antrian retry kalau gagal/offline.

## Non-blocking seperti `push-on-write/`

TIDAK pernah melempar ke caller. Catch block di `index.ts` SENGAJA kosong (best-effort) — sisa baris yang gagal di loop bisa dikirim ulang lewat backfill manual.
