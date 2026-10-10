# use-pull-sync

Pull sekali saat app dibuka (kalau `cloud_sync_enabled` + kredensial lengkap) — lihat "Logic pull" di `docs/todos/plan/mcp-server-cloud-mirror.md`. Best-effort/non-blocking, pola SAMA dengan `useRetailkuMappingIssues` (silently skip kalau offline/gagal, TIDAK menunda render apa pun atau melempar error ke UI).

Dipasang SEKALI di root (`app/providers.tsx`), bukan per-halaman — pull hanya perlu terjadi sekali per sesi app terbuka, bukan tiap navigasi. `useRef` (`hasPulledRef`) mencegah pull dobel akibat React StrictMode / re-render Settings berubah.

## `attachmentFolderReady`: kenapa `isSuccess`, bukan cuma `data`

`isSuccess` (bukan cuma `data`) WAJIB dicek — `data` query lain yang kebetulan sama-sama `null` (folder belum di-custom) TIDAK bisa dibedakan dari "belum selesai fetch" kalau cuma lihat `data`.

Bug nyata (2026-10-09): pull attachment sempat jalan SEBELUM query ini selesai, `attachmentFolder` masih `undefined` di closure `useEffect` (keduanya mulai fetch paralel saat mount, tidak ada jaminan urutan selesai) — file hasil pull jatuh ke folder default, bukan folder custom yang sudah di-set user.

## `run-pull.ts`: urutan langkah WAJIB

1. **Retry antrian push gagal DULU** — supaya perubahan lokal yang belum sempat terkirim (mis. app ditutup saat offline) jalan sebelum pull, lebih kecil kemungkinan ketiban "race" dengan perubahan dari sisi lain yang datang lewat pull berikutnya.
2. **Pull tabel data biasa** (`applySyncResponse`) lalu simpan checkpoint-nya.
3. **Pull attachment SETELAH** tabel data biasa — lihat `shared/cloud-sync/pull-attachments/README.md` (butuh transaksi induk sudah ada lokal).
4. **Invalidate semua query** — pull menulis langsung ke SQLite di luar jalur mutation biasa, jadi semua query data (transactions/accounts/dst) berpotensi stale setelah ini; `queryClient.invalidateQueries()` dipanggil tanpa filter supaya UI refresh menyeluruh.

## Catch di `index.ts`

Best-effort: offline/Worker down/token salah — diam-diam skip, dicoba lagi di sesi berikutnya (`hasPulledRef` di-reset ke `false` supaya retry bisa jalan lagi kalau `enabled` berubah). Tombol "Tes Koneksi" di Settings sudah menangani feedback eksplisit untuk kredensial salah, jadi hook ini tidak perlu menampilkan error ke UI.
