# Cloud Sync (Sisi PC) — Kelola Data Keuangan dari HP via Claude

> **Dokumen ini DIPECAH (2026-09-30)** — sebelumnya berisi SEMUA
> keputusan lintas-app (desktop+worker+mcp-server) sekaligus, padahal
> isinya banyak yang bukan tanggung jawab `apps/desktop`. Sekarang:
> keputusan desain umum, skema D1, endpoint Worker, autentikasi
> PC↔Worker, dan progress implementasi Worker ada di
> [`apps/worker/docs/todos/plan/cloud-sync.md`](../../../../worker/docs/todos/plan/cloud-sync.md).
> Dokumen INI cuma berisi yang jadi tanggung jawab PC: migrasi lokal,
> titik integrasi UI Settings, dan Tahap 6 (integrasi klien). Lihat
> [`docs/todos/plan/cloud-sync-mcp.md`](../../../../../docs/todos/plan/cloud-sync-mcp.md) di root repo utk
> index navigasi lintas-app.

## Latar belakang

Kebutuhan intinya: aplikasi mobile native (`apps/mobile`) belum
dibangun sama sekali (masih skeleton Expo kosong), TAPI ingin sudah
bisa mengelola data keuangan dari HP SEKARANG — jawabannya lewat
Claude Web + MCP server yang tool-nya setara operasi CRUD di app
desktop, bukan menunggu app mobile jadi.

Lanjutan dari `mcp-server-for-claude.md` (riset awal MCP server) dan
`uuid-migration.md` (prasyarat teknis, SELESAI). PC (`finance.dev.db`)
TETAP 100% bisa dipakai offline-first — constraint ini tidak berubah.
Yang baru: PC WAJIB pull dari D1 sebelum push (bukan snapshot buta),
karena D1 sekarang punya 2 sumber tulis (PC dan tool MCP). Detail
lengkap kenapa & keputusan conflict resolution (LWW dst) ada di
dokumen `apps/worker` yang ditautkan di atas.

## Migrasi skema PC — Tahap 3 (bagian PC)

- [x] Audit tabel: TIDAK ADA satu tabel pun yang sudah punya
      `updated_at` sebelumnya — semua cuma punya `created_at` (diisi
      sekali saat INSERT). 7 tabel data user relevan disinkron:
      `transactions`, `accounts`, `account_groups`, `categories`,
      `contacts`, `debts`, `debt_payments`. TIDAK relevan: `settings`
      (config lokal per-device), `transaction_attachments` (file
      lokal, di luar D1).
- [x] Migrasi: `src-tauri/migrations/0028_cloud_sync_columns.sql` (+
      didaftarkan di `src-tauri/src/migrations.rs` versi 28) — nambah
      `updated_at`, `deleted_at`, `sync_source` (BUKAN `source` —
      bentrok dgn kolom `source` BISNIS yg sudah ada di
      `transactions`/`debts`, maknanya beda sama sekali: asal data
      `'manual'`/`'retailku_sync'` vs asal penulis sync `'pc'`/`'mcp'`).
      `updated_at` di-backfill dari `created_at` utk baris lama,
      auto-refresh via trigger `AFTER UPDATE` per tabel (bukan diisi
      manual di kode TS — supaya tidak ada titik lupa isi). **DIVERIFIKASI
      jalan di `finance.dev.db` nyata** (bukan cuma database uji) —
      migrasi tercatat sukses di `_sqlx_migrations`, 0 baris NULL di
      `updated_at` di ketujuh tabel, trigger terbukti bekerja (diuji
      lewat copy WAL+SHM ke scratchpad, lihat
      `docs/rules/checking-dev-database.md` utk prosedurnya).
- [ ] Checkpoint sync terakhir disimpan di PC (tabel `settings`) —
      BELUM dikerjakan, menyusul di Tahap 6 di bawah.

**Catatan penting utk migrasi Tauri**: menulis file `.sql` baru di
`src-tauri/migrations/` TIDAK CUKUP — wajib juga didaftarkan manual di
`src-tauri/src/migrations.rs` (`include_str!` per file, bukan
auto-scan folder). Lupa mendaftarkan berarti migrasi TIDAK PERNAH
jalan, berapa kali pun `tauri dev` di-restart.

## Titik integrasi UI (Settings) — cara user menyalakan/mematikan fitur ini

Dicek pola yang SUDAH ADA di `src/features/settings/` supaya konsisten
— kasus paling mirip adalah `content/retailku-integration/` (sync
opsional ke layanan luar, dikonfigurasi dari Settings). Meski arah
Retailku terbalik (app ini jadi MCP CLIENT ke Retailku, sedangkan fitur
ini app jadi sumber data utk MCP SERVER terpisah), pola UI/penyimpanannya
tetap bisa dicontoh langsung:

- **Section baru di halaman Settings**: `content/cloud-sync/` (folder
  baru), mengikuti struktur `attachment-folder/` — `cloud-sync-section.tsx`
  (Card wrapper), `cloud-sync-form.tsx` (UI murni), `use-cloud-sync-form.ts`
  (state+logic, terpisah total dari render — konvensi tiap file lain di
  folder ini).
- **Toggle aktif/nonaktif**: pakai komponen `<Switch>` yang sudah ada
  (`components/ui/switch.tsx`), pola pemakaian dicontoh dari
  `features/retailku/mapping/form/follow-source-toggle.tsx` (`Switch`
  dibungkus `Controller` react-hook-form, help text kondisional saat
  aktif). BUKAN cuma "isi API key = otomatis aktif" seperti Retailku
  (yang toggle-nya implisit dari kelengkapan field) — di sini toggle
  EKSPLISIT lebih tepat karena on-write push akan langsung mulai
  mengirim data ke internet begitu diaktifkan; user perlu kontrol
  jelas kapan itu boleh mulai terjadi, bukan cuma "kebetulan kredensial
  sudah lengkap".
- **Penyimpanan konfigurasi**: tabel `settings` key-value yang SUDAH
  ADA (`src-tauri/migrations/0001_initial.sql`), TIDAK perlu tabel/
  migrasi baru untuk config. Key baru yang dibutuhkan:
  - `cloud_sync_enabled` (`"1"`/`"0"`) — status toggle.
  - `cloud_sync_worker_url` — URL endpoint Worker (`apps/worker`).
  - `cloud_sync_token` — token PC↔Worker (lihat "Autentikasi PC↔Worker"
    di dokumen `apps/worker`, BELUM ada bentuknya).
  - `cloud_sync_last_checkpoint` — timestamp sync terakhir (utk pull
    incremental).
  Dibaca/ditulis dgn pola PERSIS sama seperti
  `use-retailku-settings.ts`/`use-attachment-folder.ts`: `useQuery` +
  `useDbMutation` (wrapper generik yg sudah ada di
  `hooks/use-db-mutation.ts`, otomatis invalidate query + toast).
- **Keamanan token — DIPUTUSKAN plaintext di tabel `settings`**
  (2026-09-30, konsisten dgn `retailku_api_key`), BUKAN OS keychain/
  Stronghold. Alasan SAMA dgn yg sudah dicatat utk Retailku: aplikasi
  desktop single-user, database tidak pernah meninggalkan mesin kecuali
  saat memanggil layanan (di sini: Worker) itu sendiri —
  DIPERTIMBANGKAN ULANG scr eksplisit (bukan asumsi ikut2an) krn token
  ini scope-nya LEBIH BESAR dari token Retailku (buka akses TULIS ke
  SELURUH data keuangan, bukan cuma baca data toko sendiri), tapi tetap
  dianggap setara risiko krn tokennya PC generate sendiri utk endpoint
  miliknya sendiri, bukan kredensial pihak ketiga.
- **Visibilitas fitur lain saat aktif** — pola sidebar kondisional
  Retailku (`app-sidebar.tsx`, menu muncul HANYA kalau
  `isRetailkuConnected`) BISA dicontoh kalau nanti ada halaman
  tambahan terkait sync (mis. "riwayat sync"/"status koneksi") — tapi
  utk fase awal, cukup section di Settings saja, TIDAK perlu halaman
  terpisah dulu (beda dgn `features/retailku/config/` yg py halaman
  sendiri krn opsinya jauh lebih banyak).
- **Apa yang terjadi saat toggle di-ON-kan**: (a) generate/tampilkan
  cara dapat `cloud_sync_worker_url`+`cloud_sync_token` (kemungkinan:
  di-generate manual sekali oleh developer/user sendiri saat setup
  Worker pertama kali, ditempel di form — MIRIP alur Retailku "salin
  dari halaman API Keys mereka", tapi di sini "salin dari hasil
  `wrangler` setup sendiri"), (b) begitu toggle ON dan kredensial
  lengkap, PC mulai (i) pull sekali saat itu juga, (ii) pasang hook
  push on-write utk semua operasi tulis berikutnya. Toggle OFF =
  hentikan hook push, TIDAK menghapus data yg sudah ter-sync di D1
  (D1 tetap ada, MCP server tetap bisa dipakai dari HP walau PC lagi
  "mode offline dari sync" — cuma PC berhenti kirim/terima perubahan
  sampai di-ON-kan lagi).
- **Tombol "Tes Koneksi"** — dicontoh dari pola Retailku
  (`handleTestConnection` di `use-retailku-settings-form.ts`): verifikasi
  manual bahwa Worker bisa dihubungi dgn token yg dimasukkan, TANPA
  menulis apa pun, sebelum toggle benar2 diaktifkan.

## Todo list eksekusi (Tahap 6 — Integrasi klien PC)

- [ ] Section baru `content/cloud-sync/` di `features/settings/` —
      toggle `<Switch>` + field URL Worker + token, pola dicontoh dari
      `retailku-integration/` (lihat "Titik integrasi UI" di atas).
- [ ] Key baru di tabel `settings`: `cloud_sync_enabled`,
      `cloud_sync_worker_url`, `cloud_sync_token`,
      `cloud_sync_last_checkpoint` — via `useQuery`+`useDbMutation`,
      TIDAK perlu migrasi tabel baru.
- [ ] Tombol "Tes Koneksi" (verifikasi token+URL valid, tanpa menulis).
- [ ] Logic pull saat app dibuka+online (HANYA kalau
      `cloud_sync_enabled`): bandingkan `updated_at` per baris,
      terapkan yang menang ke SQLite lokal, update checkpoint.
- [ ] Logic push ON-WRITE (HANYA kalau `cloud_sync_enabled`): hook di
      tiap titik INSERT/UPDATE/DELETE (soft) yang relevan, kirim baris
      itu ke Worker segera (async, tidak blocking UI) kalau online;
      kalau offline, masuk antrian lokal (tabel/queue kecil) utk
      dikirim ulang saat online lagi.
- [ ] Retry/antrian utk push yang gagal (offline saat terjadi, atau
      request gagal) — jangan sampai perubahan hilang senyap kalau
      push pertama gagal.
- [ ] Toggle OFF = hentikan hook push/pull, TIDAK menghapus data yang
      sudah ter-sync di D1 (D1 & MCP server tetap jalan independen).

**Prasyarat sebelum Tahap 6 bisa mulai**: endpoint Worker WAJIB sudah
punya autentikasi PC↔Worker (belum ada — lihat dokumen `apps/worker`)
supaya PC tidak push data lewat endpoint yang masih terbuka tanpa
proteksi.

## Verifikasi (sisi PC)

- [ ] Uji skenario inti: tambah transaksi dari HP (via Claude/MCP)
      SAAT PC mati → nyalakan PC → pastikan transaksi itu muncul
      setelah pull, TIDAK hilang.
- [ ] Uji skenario konflik: edit baris sama dari PC (offline dari
      internet, misal) dan dari HP hampir bersamaan → pastikan
      `updated_at` lebih baru yang menang, bukan silent corruption.
- [ ] Uji constraint "PC tetap 100% offline-first" tidak regresi.
- [ ] Uji soft delete: hapus dari satu sisi, sisi lain sempat edit
      sebelum tahu — pastikan resolve masuk akal (bukan crash/data
      hilang tanpa jejak sama sekali).

## Terkait

- [`apps/worker/docs/todos/plan/cloud-sync.md`](../../../../worker/docs/todos/plan/cloud-sync.md)
  — dokumen UTAMA: keputusan desain lengkap (LWW, soft delete,
  `sync_source`), skema D1, endpoint Worker, autentikasi, roadmap
  Tahap 0/1/4/5/7, progress implementasi terkini.
- [`mcp-server-business-logic-audit.md`](./mcp-server-business-logic-audit.md)
  — hasil audit LENGKAP logic bisnis `apps/desktop` yang wajib
  direplikasi ke Worker sebelum tool tulis MCP aktif. TETAP di sini
  (bukan pindah ke `apps/worker`) krn isinya murni audit kode desktop
  (file:baris spesifik), meski dipakai sbg checklist porting Worker.
- [`docs/todos/plan/cloud-sync-mcp.md`](../../../../../docs/todos/plan/cloud-sync-mcp.md) — index navigasi
  lintas-app di root repo.
- `mcp-server-for-claude.md` — riset paling awal, opsi hosting/
  autentikasi/tooling dasar (masih berlaku, lihat "Riset autentikasi &
  hosting" di dokumen `apps/worker`).
- `multi-device-sync-engine.md` — DISIMPAN utk nanti, kasus BERBEDA
  (mobile app nativ sungguhan, bukan tool MCP) — TAPI keputusan
  LWW/soft-delete di sana jadi RUJUKAN LANGSUNG utk dokumen
  `apps/worker` krn kasusnya mirip.
- `docs/rules/checking-dev-database.md` — prosedur verifikasi migrasi
  lokal PC (copy `.db`+`.db-wal`+`.db-shm`, jangan query file aktif
  langsung).
