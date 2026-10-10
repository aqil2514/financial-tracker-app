# cloud-sync

Sinkronisasi dua arah antara SQLite lokal (desktop) dan D1 lewat `apps/worker` (Cloudflare) — fondasi Tahap 6, lihat `docs/todos/plan/mcp-server-cloud-mirror.md`. Tiap submodul punya `README.md` sendiri untuk detail desain; file ini cuma peta bagaimana semuanya berhubungan.

## Arah PUSH (desktop -> D1)

- **`worker-client/`** — client HTTP murni ke Worker. Satu fungsi per endpoint (`pushTransaction`, `pushAccount`, `pullSync`, `deleteCloudRow`, dst), tidak tahu kapan dipanggil, cuma tahu caranya.
- **`push-row/`** — baca 1 baris terbaru dari SQLite lalu format jadi payload, panggil fungsi `worker-client/` yang sesuai. Satu sumber kebenaran untuk shape payload, dipakai push langsung maupun retry.
- **`push-on-write/`** — titik panggil dari `mutationFn` tiap hook create/update/delete. Push segera; gagal/offline masuk antrian.
- **`push-queue/`** — antrian retry (tabel `cloud_sync_queue`) untuk push yang gagal. Dijalankan ulang saat app dibuka.
- **`push-retailku-sync/`** — push khusus baris `transactions` hasil sync Retailku (insert-nya bukan lewat hook form, jadi tidak lewat `push-on-write/` otomatis).
- **`backfill-sync/`** — push SEMUA data lokal existing sekali jalan, untuk data yang sudah ada SEBELUM toggle cloud sync ON.

Alur normal: hook mutation -> `push-on-write/` -> `push-row/` (format payload) -> `worker-client/` (kirim HTTP). Gagal -> `push-queue/` (simpan) -> `retryPendingPushes` (dipanggil dari `use-pull-sync/`) -> `push-row/` lagi.

## Arah PULL (D1 -> desktop)

- **`worker-client/`** — `pullSync` (`GET /sync`) dan `listAttachmentsSince`/`getAttachmentBytes` (`GET /attachments`).
- **`pull-sync/`** — terapkan `SyncResponse` (tabel data biasa) ke SQLite lokal, LWW per baris, hard-delete kalau `deletedAt` terisi.
- **`pull-attachments/`** — terapkan daftar attachment, download file dari R2 ke disk. Checkpoint TERPISAH dari `pull-sync/` karena endpoint/siklusnya beda.
- **`use-pull-sync/`** — hook `useAutoPullSync`, dipasang sekali di root (`app/providers.tsx`). Urutan wajib: retry push dulu -> `pull-sync/` -> `pull-attachments/` -> invalidate semua query.

## Kredensial & state

- **`use-cloud-sync-settings/`** — kredensial (`workerUrl`/`token`) + dua checkpoint (`lastCheckpoint` untuk `/sync`, `lastAttachmentsCheckpoint` untuk `/attachments`), disimpan di tabel `settings` key-value.

## Test

- **`test/`** — test untuk modul-modul di atas (`pull-sync.test.ts`, `worker-client.test.ts`). Satu file per modul yang diuji, bukan 1:1 per submodul folder.

## Konvensi tiap submodul

Tiap folder modul (`pull-sync/`, `push-on-write/`, dst) mengikuti pola yang sama: `index.ts` sebagai titik masuk (fungsi utama atau barrel re-export kalau modul itu punya beberapa fungsi publik setara), satu file per fungsi tanpa komentar inline, dan `README.md` menampung narasi desain/kronologi bug yang sebelumnya ada sebagai komentar header. Baca `README.md` submodul itu sebelum mengubah kodenya.
