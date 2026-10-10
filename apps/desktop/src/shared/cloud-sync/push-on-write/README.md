# push-on-write

Titik panggil push-on-write — dipakai dari dalam `mutationFn` tiap hook create/update/delete (lihat "Logic push ON-WRITE" di `docs/todos/plan/mcp-server-cloud-mirror.md`).

## `resolve-credentials.ts`

Baca kredensial LANGSUNG dari tabel `settings` via SQL (bukan `useCloudSyncSettings()` — hook React Query tidak bisa dipanggil di dalam `mutationFn`, yang jalan di luar render React), supaya modul ini tetap dipanggil dari fungsi biasa, bukan hook.

## Kontrak: async non-blocking

SEMUA fungsi di folder ini TIDAK boleh melempar error ke caller (`mutationFn` hook) — kegagalan push bukan kegagalan operasi lokal. Gagal/offline -> masuk antrian retry, `mutationFn` tetap resolve normal.

## `push-on-write.ts`

Panggil setelah INSERT/UPDATE lokal sukses — push baris ke Worker segera, masuk antrian kalau gagal/offline.

`'rejected'` (422, validasi bisnis Worker) TIDAK di-retry — data lokal valid menurut desktop sendiri, payload yang sama akan ditolak lagi tanpa ada yang berubah. Dibiarkan sebagai divergence sampai user edit ulang (akan push lagi dengan data baru).

## `push-delete-on-write.ts`

Panggil SEBELUM hard-delete lokal (keputusan 2026-10-01) — supaya kalau push gagal/offline, delete lokal TETAP lanjut (desktop offline-first, tidak boleh diblokir internet) dan masuk antrian retry dengan payload action yang sama.

## `push-delete-transaction-on-write.ts`

Khusus `transactions` — terpisah dari `pushDeleteOnWrite` karena punya bentuk return beda (bukan `void`): endpoint Worker balas `debtInfo` (tindakan terhadap debt/debt_payments terkait, TUNGGAL per role, TANPA payload pilihan dari client), dipakai dialog PC untuk toast informatif SETELAH delete berhasil.

`null` kalau offline/gagal (masuk antrian retry, sama kebijakan non-blocking dengan `pushDeleteOnWrite`) ATAU kalau cloud sync belum aktif — caller treat sebagai "tidak ada info tambahan untuk ditampilkan", BUKAN error.

## `push-delete-attachment-on-write.ts`

Khusus `transaction_attachments` — `pushDeleteOnWrite` generik juga cocok (endpoint `DELETE /attachments/:id` TANPA payload action, sama bentuknya dengan `contacts`/`transactions`), tapi dibungkus fungsi terpisah supaya caller (`use-delete-attachment.ts`) tidak perlu tahu payload kosong `{}` yang wajib dikirim untuk tipe `DeleteCloudPayload`.

## `detach-label-on-write.ts`

Detach label — TIDAK lewat `pushDeleteOnWrite` generik (bentuk path Worker-nya 3 segment: `scope/entityId/labelId`, bukan 1 `:id`) dan TIDAK punya antrian retry sendiri. Keputusan: detach gagal karena offline dianggap acceptable eventual-consistency gap kecil, beda dari upsert yang harus selalu sampai — re-detach yang sama idempotent di sisi Worker kalau user membuka app lagi & retry manual via re-sync nanti. Catch block kosong di fungsi ini SENGAJA — best-effort tanpa fallback.

## `retry-pending-pushes.ts`

Jalankan ulang antrian retry — dipanggil saat app dibuka (bareng pull). Best-effort, diam-diam skip kalau offline/kredensial belum lengkap.
