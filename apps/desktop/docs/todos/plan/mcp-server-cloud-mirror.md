# MCP Server — Sync Dua-Arah PC ↔ Cloud + CRUD via Claude

> **Perubahan besar (2026-09-30, sesi sama)**: dokumen ini AWALNYA
> dirancang sbg "cloud mirror satu-arah, MCP read-only" (judul lama:
> "Cloud Mirror Satu-Arah"). Setelah dibahas ulang, kebutuhan
> sebenarnya adalah **CRUD PENUH lewat HP/Claude Web, setara dengan
> yang bisa dilakukan di PC** — bukan cuma tanya saldo, tapi tambah/
> edit/hapus transaksi dkk dari HP SEBELUM aplikasi mobile native ada.
> Ini mengubah premis dasar: D1 sekarang py **DUA sumber tulis** (PC
> dan MCP tool atas nama HP), bukan satu. Seluruh dokumen ditulis
> ulang utk mencerminkan ini — draft lama (read-only, snapshot penuh
> tanpa conflict resolution) SUDAH TIDAK BERLAKU.

## Latar belakang

Lanjutan dari `mcp-server-for-claude.md` (riset awal MCP server utk
Claude Web) dan `uuid-migration.md` (prasyarat teknis, SELESAI).
Kebutuhan intinya: aplikasi mobile native (`apps/mobile`) belum
dibangun sama sekali (masih skeleton Expo kosong), TAPI ingin sudah
bisa mengelola data keuangan dari HP SEKARANG — jawabannya lewat
Claude Web + MCP server yang tool-nya setara operasi CRUD di app
desktop, bukan menunggu app mobile jadi.

**Kenapa dokumen ini TETAP terpisah dari `multi-device-sync-engine.md`**
meski sama-sama akhirnya butuh conflict resolution: dokumen itu
dirancang utk kasus desktop ↔ MOBILE APP NATIF saling sync (2 aplikasi
penuh, offline-first di kedua sisi, device fisik berbeda yang bisa
lama sekali tidak online). Dokumen INI kasusnya lebih sempit: PC ↔ D1,
dengan sisi kedua BUKAN aplikasi mandiri tapi **tool MCP yang dipanggil
Claude Web** — selalu online saat dipakai (tidak ada "HP offline
seharian"), tidak py SQLite lokal sendiri (Claude langsung baca/tulis
ke D1 tiap tool call, tidak ada local-first di sisi ini). Lebih simpel
dari kasus mobile-native, tapi TIDAK SESIMPEL "satu penulis" spt draft
awal dokumen ini.

`multi-device-sync-engine.md` TETAP disimpan apa adanya utk nanti kalau
`apps/mobile` sungguhan mulai dibangun (kasus offline-first beneran di
2 device fisik) — TIDAK digabung ke sini, TIDAK dihapus.

## Konteks penting: kenapa ini BUKAN "satu penulis" lagi

Draft awal dokumen ini berasumsi PC = satu-satunya sumber tulis, D1 =
mirror baca-saja. Begitu tool MCP boleh CRUD (bukan cuma baca), asumsi
itu runtuh:
- PC bisa menulis (seperti biasa, lokal dulu, lalu push/pull ke D1).
- MCP tool (dipanggil Claude atas permintaan user dari HP) bisa
  menulis LANGSUNG ke D1, TANPA lewat PC sama sekali.
- Kalau PC push snapshot penuh begitu saja (rencana awal), itu akan
  MENIMPA perubahan yang baru dibuat dari HP — regresi data.

**Konsekuensi desain**: perlu conflict resolution beneran, mirip
(bukan sama persis) dgn yang sudah diputuskan di
`multi-device-sync-engine.md`.

## Keputusan desain final

- **Strategi conflict resolution: last-write-wins sederhana via
  `updated_at`** (dipilih 2026-09-30, SETELAH mempertimbangkan &
  MENOLAK alternatif tabel log/event-sourcing terpusat). Alasan
  penolakan log terpusat: menang di "tidak pernah kehilangan data
  diam-diam", TAPI kalah jauh di effort jangka panjang (semua fitur
  baru ke depan wajib juga menulis ke log, permanent tax) dan storage
  (log tumbuh tak terbatas, butuh snapshotting supaya replay tetap
  cepat). Untuk skala personal ini (bukan sistem finansial
  multi-pihak kritikal), trade-off "bisa kehilangan perubahan yang
  kalah, kasus jarang" diterima — konsisten dgn keputusan LWW yang
  sama di `multi-device-sync-engine.md`. Log audit BISA ditambah nanti
  sbg fitur terpisah (mis. utk fitur "riwayat aktivitas" di app) kalau
  memang dibutuhkan — TIDAK digabung ke mekanisme sync/resolusi konflik.
- **PC WAJIB pull dari D1 SEBELUM push** (bukan snapshot buta spt draft
  awal) — supaya perubahan yg dibuat lewat MCP/HP sejak sync terakhir
  tidak hilang tertimpa. Alur per baris saat pull: bandingkan
  `updated_at` D1 vs lokal, yang lebih baru menang, terapkan ke lokal.
  Alur push: kirim baris lokal yg `updated_at`-nya lebih baru dari
  checkpoint sync terakhir (BUKAN snapshot penuh lagi — snapshot penuh
  cuma valid kalau satu arah, sekarang dua arah butuh gerakan lebih
  presisi per baris).
- **Pemicu pull: saat app dibuka + online** (tetap sama spt draft awal).
  **Pemicu push: ON-WRITE** (dipilih 2026-09-30, BERBEDA dari pull) —
  begitu user tambah/edit/hapus data di PC, langsung push baris itu ke
  D1 saat itu juga (async, tidak blocking UI), kalau online. Kalau
  offline, masuk antrian lokal, dikirim saat online lagi (mis. saat
  pull berikutnya berjalan, atau begitu koneksi kembali). Alasan beda
  dari pull: window "PC punya data baru yg belum sampai ke D1" perlu
  sekecil mungkin (detik-menit, bukan jam) krn D1 sekarang bisa berubah
  dari HP KAPAN SAJA — push lambat (mis. cuma saat app dibuka/ditutup)
  memperbesar peluang bentrok nyata dgn perubahan dari HP di antara itu.
- **Soft delete relevan lagi** (`deleted_at`) — sama alasannya dgn
  `multi-device-sync-engine.md`: hard delete di satu sisi (PC hapus
  transaksi) sementara sisi lain (MCP) sempat UPDATE baris yg sama
  sebelum tahu terhapus → ambigu. Soft delete tetap bisa dibandingkan
  by timestamp.
- **`device_id`/`source` per baris — disertakan**, tapi bentuknya beda
  dari `multi-device-sync-engine.md` (bukan UUID per install device
  fisik, cukup enum sederhana: `"pc"` vs `"mcp"`) — berguna utk audit
  ringan ("perubahan ini dari HP atau dari PC") tanpa kompleksitas
  identitas device penuh (krn cuma ada 2 "sumber", bukan N device fisik
  yg tak diketahui jumlahnya).
- **Tool MCP CRUD setara operasi PC** — bukan cuma 5 tool baca dari
  draft awal, tapi tool tulis yg logic-nya SEPADAN dgn validasi yg
  sudah ada di app desktop (mis. kalau ada aturan "saldo tidak boleh
  minus" atau logic alokasi FIFO pelunasan utang piutang di app
  desktop, tool tulis MCP WAJIB menghormati aturan yg sama, bukan raw
  INSERT/UPDATE tanpa validasi). Ini brarti sebagian LOGIC BISNIS dari
  `src/features/*` app desktop perlu di-port/direplikasi ke sisi
  server (Cloudflare Worker atau Vercel function) — bukan trivial,
  perlu diinventarisir Tahap berikutnya.
- **Tetap Cloudflare D1** (bukan Turso) — alasan sama dgn
  `multi-device-sync-engine.md` (Turso wajib ganti driver DB, LWW tdk
  built-in; D1 = SQLite juga, skema tdk perlu diterjemahkan).
- **Tetap Vercel Hobby + `mcp-handler`** utk hosting MCP server, TETAP
  OAuth shim di atas API key statis utk autentikasi (pola dicontoh dari
  implementasi live MCP Retailku — lihat "Riset autentikasi" di bawah,
  BAGIAN INI TIDAK BERUBAH dari draft awal).

## Alur yang dibangun

```
                    ┌─────────────────────────────┐
                    │  Cloudflare D1 (sumber       │
                    │  kebenaran BERSAMA, dua      │
                    │  sisi baca+tulis)            │
                    └──────────────┬───────────────┘
                     pull-lalu-push │  baca+tulis langsung
                    (saat app buka  │  (tiap tool call MCP,
                     +online)       │  real-time)
           ┌────────────────────────┴────────────────────────┐
           │                                                  │
┌──────────▼──────────┐                          ┌────────────▼────────────┐
│ SQLite lokal PC      │                          │ MCP server (Vercel)     │
│ (finance.db)         │                          │ tool CRUD, panggil D1   │
│ TETAP offline-first, │                          │ langsung tiap request   │
│ sync ke D1 opsional  │                          │ dari Claude Web (HP)    │
└──────────────────────┘                          └─────────────┬───────────┘
                                                                  │
                                                        ┌─────────▼─────────┐
                                                        │ Claude Web (HP)    │
                                                        └────────────────────┘
```

PC tetap 100% bisa dipakai offline (constraint tak berubah). Bedanya
dari draft awal: PC sekarang WAJIB *pull* sebelum *push* setiap kali
sync, dan D1 bukan lagi "mirror pasif" tapi sumber kebenaran bersama
yang bisa berubah dari 2 arah.

## Titik integrasi UI (desktop) — cara user menyalakan/mematikan fitur ini

Dicek pola yang SUDAH ADA di `src/features/settings/` supaya konsisten
— kasus paling mirip adalah `content/retailku-integration/` (sync
opsional ke layanan luar, dikonfigurasi dari Settings). Meski arah
Retailku terbalik (app ini jadi MCP CLIENT ke Retailku, sedangkan fitur
ini app jadi MCP SERVER), pola UI/penyimpanannya tetap bisa dicontoh
langsung:

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
  EKSPLISIT lebih tepat karena on-write push (lihat "Pemicu push") akan
  langsung mulai mengirim data ke internet begitu diaktifkan; user perlu
  kontrol jelas kapan itu boleh mulai terjadi, bukan cuma "kebetulan
  kredensial sudah lengkap".
- **Penyimpanan konfigurasi**: tabel `settings` key-value yang SUDAH
  ADA (`src-tauri/migrations/0001_initial.sql`), TIDAK perlu tabel/
  migrasi baru untuk config. Key baru yang dibutuhkan:
  - `cloud_sync_enabled` (`"1"`/`"0"`) — status toggle.
  - `cloud_sync_worker_url` — URL endpoint Cloudflare Worker.
  - `cloud_sync_token` — token PC↔Worker (lihat "Autentikasi PC↔Worker").
  - `cloud_sync_last_checkpoint` — timestamp sync terakhir (utk pull
    incremental, lihat Tahap 3).
  Dibaca/ditulis dgn pola PERSIS sama seperti
  `use-retailku-settings.ts`/`use-attachment-folder.ts`: `useQuery` +
  `useDbMutation` (wrapper generik yg sudah ada di
  `hooks/use-db-mutation.ts`, otomatis invalidate query + toast).
- **Keamanan token — DIPUTUSKAN plaintext di tabel `settings`**
  (2026-09-30, konsisten dgn `retailku_api_key`), BUKAN OS keychain/
  Stronghold. Alasan SAMA dgn yg sudah dicatat utk Retailku: aplikasi
  desktop single-user, database tidak pernah meninggalkan mesin kecuali
  saat memanggil layanan (di sini: Cloudflare Worker) itu sendiri —
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
  Cloudflare Worker pertama kali, ditempel di form — MIRIP alur
  Retailku "salin dari halaman API Keys mereka", tapi di sini "salin
  dari hasil `wrangler` setup sendiri"), (b) begitu toggle ON dan
  kredensial lengkap, PC mulai (i) pull sekali saat itu juga, (ii) pasang
  hook push on-write utk semua operasi tulis berikutnya. Toggle OFF
  = hentikan hook push, TIDAK menghapus data yg sudah ter-sync di D1
  (D1 tetap ada, MCP server tetap bisa dipakai dari HP walau PC lagi
  "mode offline dari sync" — cuma PC berhenti kirim/terima perubahan
  sampai di-ON-kan lagi).
- **Tombol "Tes Koneksi"** — dicontoh dari pola Retailku
  (`handleTestConnection` di `use-retailku-settings-form.ts`): verifikasi
  manual bahwa Worker bisa dihubungi dgn token yg dimasukkan, TANPA
  menulis apa pun, sebelum toggle benar2 diaktifkan.

## Riset autentikasi & hosting (hasil, TIDAK BERUBAH dari draft awal)

Bagian ini sudah diriset & diputuskan sebelum perubahan besar di atas,
tetap berlaku:

- **Hosting: Vercel Hobby**, package **`mcp-handler`** (Next.js App
  Router) — isolasi penuh dari server bisnis Retailku, Rp0 utk skala
  personal.
- **Autentikasi: OAuth shim di atas API key statis** — diverifikasi
  dari implementasi LIVE MCP Retailku (`Warung Aqil`) di
  `D:\Programming\Pribadi\retail-multitenant\apps\api\src\app\mcp\`.
  Claude Web mewajibkan alur discovery OAuth
  (`.well-known/oauth-protected-resource`, `/register`,
  `/oauth/authorize`, `/oauth/token`), tapi di baliknya cukup satu form
  HTML "masukkan API key" — `access_token` yg dikembalikan ya API key
  itu sendiri (di-hash utk validasi), `expires_in` di-set sangat
  panjang. Utk `financial-app`, LEBIH SEDERHANA drpd Retailku krn
  single-user: satu token env var, tanpa tabel database.
- **Akses D1 baca dari Vercel: langsung via REST API**
  (`POST https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query`,
  `Authorization: Bearer <CLOUDFLARE_API_TOKEN>`), rate limit 1200
  req/5menit per akun — jauh cukup utk skala personal, TIDAK perlu
  Worker perantara utk baca.
- **Akses D1 tulis**: TETAP lewat Cloudflare Worker (native binding,
  bukan REST API) — TAPI sekarang Worker ini dipanggil dari 2 arah:
  dari PC (sync push) DAN berpotensi dari Vercel MCP tool (kalau tool
  tulis MCP tidak langsung akses D1 REST API, tapi lewat Worker jg utk
  konsistensi logic validasi — lihat "Yang belum diputuskan").

## Yang BELUM diputuskan

- [ ] **Arsitektur tool tulis MCP**: apakah Vercel MCP function akses
      D1 langsung (REST API, tulis manual dgn `updated_at`+validasi di
      kode Vercel), ATAU tool tulis MCP memanggil Cloudflare Worker yg
      SAMA dipakai PC utk sync (supaya logic validasi/`updated_at`
      terpusat di satu tempat, tidak dobel-tulis di Vercel & Worker).
      Condong ke opsi kedua (logic terpusat) tapi belum final.
- [ ] **Inventarisir logic bisnis yang perlu di-port ke server** — cek
      `src/features/*` app desktop utk aturan validasi yg WAJIB
      direplikasi di sisi server (mis. constraint saldo, alokasi FIFO
      pelunasan utang piutang yg disebut di `apply-debt-transaction.ts`
      dari sesi migrasi UUID kemarin, aturan kategori/akun, dst) —
      belum dilakukan, task besar tersendiri sebelum tool tulis
      pertama bisa dibangun dgn aman.
- [ ] Daftar tool CRUD fase pertama & urutan prioritas — draft awal py
      5 tool BACA (`get_account_balances`, dst, lihat riwayat di git
      kalau perlu dicek ulang) — perlu diperluas dgn tool TULIS, belum
      diputuskan mana yg paling mendesak (tambah transaksi dulu? edit
      saldo? dst).
- [ ] Skema kolom sync (`updated_at`, `deleted_at`, `source`) — apakah
      REUSE persis kolom yg SAMA dgn yg direncanakan di
      `multi-device-sync-engine.md` (kalau nanti mobile native jadi,
      mungkin bisa pakai skema sync yg sama utk kedua kebutuhan), atau
      dibuat terpisah krn kasusnya beda (device fisik vs tool
      MCP) — belum diputuskan, berpotensi menghemat kerja kalau bisa
      disatukan.
- [ ] Nama/struktur endpoint Worker (`/sync` masih working name).
- [ ] DI MANA token OAuth-shim/API key disimpan & di-generate.

## Todo list eksekusi

### Tahap 0 — Riset arsitektur dasar (autentikasi, hosting, akses D1) — SELESAI

- [x] Hosting: Vercel Hobby + `mcp-handler`.
- [x] Autentikasi: OAuth shim di atas API key statis (pola dari MCP
      Retailku live).
- [x] Akses D1 baca: langsung REST API dari Vercel.
- [x] Akses D1 tulis: Cloudflare Worker, native binding.

### Tahap 1 — Keputusan conflict resolution — SELESAI

- [x] Strategi: last-write-wins sederhana via `updated_at` (menolak
      tabel log terpusat/event-sourcing setelah pertimbangan
      effort-vs-jaminan).
- [x] Soft delete (`deleted_at`) relevan lagi, dipakai.
- [x] `source`/`device_id` sederhana (`"pc"` vs `"mcp"`), bukan UUID
      device penuh.
- [x] Pemicu pull: saat app dibuka+online. Pemicu push: **on-write**
      (langsung tiap ada perubahan di PC, async, kalau online).

### Tahap 2 — Inventarisir logic bisnis yang perlu direplikasi ke server

- [ ] Audit `src/features/*` app desktop: cari SEMUA aturan validasi/
      logic bisnis yang berjalan di lapisan TypeScript/React sebelum
      data sampai ke SQLite (bukan cuma constraint di skema SQL) — ini
      HARUS direplikasi di server, karena tool MCP menulis LANGSUNG ke
      D1, TIDAK lewat kode TypeScript app desktop sama sekali.
- [ ] Daftar per fitur: transaksi (validasi kategori/akun cocok?),
      debt/debt_payments (alokasi FIFO pelunasan — lihat catatan
      `apply-debt-transaction.ts` di `uuid-migration.md`), accounts
      (constraint saldo?), dst.
- [ ] Putuskan: logic ini ditulis ULANG di server (duplikasi kode,
      risiko drift antara 2 implementasi), atau diekstrak jadi shared
      logic yang bisa dipanggil dari kedua sisi (lebih ideal, tapi
      app desktop React+SQLite lokal vs server Node+D1 beda runtime,
      perlu dicek seberapa mungkin benar2 dibagi).

### Tahap 3 — Skema: siapkan kolom pendukung sync dua-arah

- [ ] Audit tabel: mana yang sudah/belum punya `updated_at`.
- [ ] Migrasi tambah `updated_at`, `deleted_at`, `source` ke tabel yang
      relevan (skema lokal PC).
- [ ] Skema D1 = replika skema lokal + kolom sync yang sama.
- [ ] Checkpoint sync terakhir disimpan di PC (tabel/`settings`).

### Tahap 4 — Cloudflare: Worker + D1

- [ ] Provisioning 1 database D1.
- [ ] Worker dgn endpoint sync (pull: kirim baris D1 sejak checkpoint
      device; push: terima baris dari PC, UPSERT dgn LWW per baris)
      DAN endpoint tulis utk tool MCP (kalau opsi "logic terpusat di
      Worker" yang dipilih di Tahap 0 lanjutan).
- [ ] Validasi/logic bisnis hasil Tahap 2 diimplementasikan di Worker.
- [ ] Autentikasi PC↔Worker (token terpisah dari OAuth-shim MCP).

### Tahap 5 — MCP server (Vercel)

- [ ] Setup Next.js App Router + `mcp-handler`.
- [ ] OAuth shim (port dari `mcp-oauth.controller.ts`/`mcp-auth.guard.ts`
      milik Retailku, disederhanakan single-user).
- [ ] Tool BACA (5 tool draft awal: saldo akun, ringkasan pengeluaran
      per kategori, list transaksi, ringkasan utang piutang, riwayat
      per kontak).
- [ ] Tool TULIS (daftar final, lihat "Yang belum diputuskan") — tiap
      tool memanggil Worker (bukan langsung D1) supaya validasi Tahap 2
      konsisten dipakai.

### Tahap 6 — Integrasi klien PC (Rust/Tauri)

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

### Tahap 7 — Verifikasi

- [ ] Uji skenario inti: tambah transaksi dari HP (via Claude/MCP)
      SAAT PC mati → nyalakan PC → pastikan transaksi itu muncul
      setelah pull, TIDAK hilang.
- [ ] Uji skenario konflik: edit baris sama dari PC (offline dari
      internet, misal) dan dari HP hampir bersamaan → pastikan
      `updated_at` lebih baru yang menang, bukan silent corruption.
- [ ] Uji validasi bisnis dari sisi MCP: coba operasi yg SEHARUSNYA
      ditolak (mis. aturan yg berlaku di app desktop) lewat tool MCP,
      pastikan server MENOLAK juga, bukan cuma divalidasi di client.
- [ ] Uji constraint "PC tetap 100% offline-first" tidak regresi.
- [ ] Uji soft delete: hapus dari satu sisi, sisi lain sempat edit
      sebelum tahu — pastikan resolve masuk akal (bukan crash/data
      hilang tanpa jejak sama sekali).

## Terkait

- `docs/todos/plan/mcp-server-for-claude.md` — riset paling awal,
  opsi hosting/autentikasi/tooling dasar (masih berlaku, lihat "Riset
  autentikasi & hosting" di atas).
- `docs/todos/plan/multi-device-sync-engine.md` — DISIMPAN utk nanti,
  kasus BERBEDA (mobile app nativ sungguhan, bukan tool MCP) — TAPI
  keputusan LWW/soft-delete di sana jadi RUJUKAN LANGSUNG utk dokumen
  ini krn kasusnya mirip (dua sumber tulis, butuh conflict resolution).
- `docs/todos/done/uuid-migration.md` — prasyarat, SUDAH SELESAI. Catat
  jg: `apply-debt-transaction.ts` (logic alokasi FIFO pelunasan utang
  piutang) disebut eksplisit di situ sbg salah satu titik yg PALING
  perlu hati-hati direplikasi ke server (Tahap 2 di atas).
- `D:\Programming\Pribadi\retail-multitenant\apps\api\src\app\mcp\` —
  implementasi LIVE rujukan pola OAuth shim (`mcp-oauth.controller.ts`,
  `mcp-auth.guard.ts`, `mcp.module.ts`, `mcp.controller.ts`).
