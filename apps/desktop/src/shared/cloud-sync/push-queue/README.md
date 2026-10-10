# push-queue

Antrian retry untuk push on-write yang gagal (offline/request gagal saat terjadi) — lihat migrasi `0029_cloud_sync_queue.sql` + `0030_cloud_sync_queue_payload.sql` dan "Retry/antrian" di `docs/todos/plan/mcp-server-cloud-mirror.md`.

## Isi antrian: `{table, id, op}`, BUKAN payload penuh

Keputusan 2026-10-01: saat retry untuk `op='upsert'`, baca ULANG row terbaru dari SQLite lokal lalu push — selalu dapat data terbaru kalau row itu diedit lagi sebelum retry sempat jalan.

PENGECUALIAN: `op='delete'` WAJIB simpan `payload` (action reassign/unassign) karena row sudah hard-deleted lokal di titik enqueue — tidak ada apa pun untuk dibaca ulang, action-nya keputusan SESAAT user saat klik delete. Lihat `enqueue-delete-push.ts`.

## `transactions` di antrian delete

Ikut antrian delete juga sejak 2026-10-03 (endpoint Worker `DELETE /transactions/:id` sudah ada) — payload action-nya SELALU kosong (`{}`), beda dari `account_groups`/`accounts`/`categories` yang punya reassign/unassign opsional (tindakan terhadap debt/debt_payments terkait di Worker TUNGGAL per role, bukan pilihan client).

`debtInfo` hasil retry delete transaksi DIABAIKAN (bukan ditampilkan via toast) — beda dari delete langsung yang dialognya masih terbuka, retry jalan di background tanpa ada yang menunggu pesan spesifik.

## `flush-push-queue.ts`

Jalankan ulang SEMUA entry antrian, urut dari yang paling lama. Dipanggil saat app dibuka (bareng pull) DAN setelah tiap push langsung gagal (percobaan ulang segera, bukan nunggu sesi berikutnya).

Best-effort: entry yang gagal lagi TETAP di antrian (`attempts++`), TIDAK melempar error ke caller.

Validasi bisnis Worker yang menolak (`result?.status === "rejected"`) — retry tidak akan pernah berhasil tanpa perubahan data, TAPI tetap disimpan di antrian (bukan dihapus diam-diam) via `mark-attempt-failed.ts`, supaya terlihat di `attempts`/`last_error` untuk investigasi, bukan hilang senyap.
