# Cloud Sync (Sisi PC) — Kelola Data Keuangan dari HP via Claude

> **Dokumen ini DIPECAH (2026-09-30)** — sebelumnya berisi SEMUA
> keputusan lintas-app (desktop+worker+mcp-server) sekaligus, padahal
> isinya banyak yang bukan tanggung jawab `apps/desktop`. Sekarang:
> keputusan desain umum, skema D1, endpoint Worker, autentikasi
> PC↔Worker, dan progress implementasi Worker ada di
> [`apps/worker/docs/todos/done/cloud-sync.md`](../../../../worker/docs/todos/done/cloud-sync.md).
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

- [x] **Key baru di tabel `settings`** (2026-10-01,
      `shared/cloud-sync/use-cloud-sync-settings.ts`):
      `cloud_sync_enabled`, `cloud_sync_worker_url`, `cloud_sync_token`,
      `cloud_sync_last_checkpoint` — via `useQuery`+`useDbMutation`,
      TIDAK perlu migrasi tabel baru. `useCloudSyncSettings()` (baca
      ke-4 key sekaligus), `useSetCloudSyncSettings()` (tulis 3 key
      pertama, dipanggil dari form Settings), `useSetCloudSyncCheckpoint()`
      (tulis checkpoint SETELAH pull berhasil — terpisah krn ini field
      internal yg diupdate OTOMATIS, bukan oleh user).
      - **Perubahan pendukung**: `useDbMutation` (hook generik,
        `hooks/use-db-mutation.ts`) ditambah opsi `silent?: boolean` —
        skip `toast.success()` tapi tetap invalidate query + jalankan
        `onSuccess`. Dibutuhkan krn checkpoint update terjadi OTOMATIS
        di background (tiap kali pull sukses, bukan 1x aksi user) — tanpa
        ini toast "berhasil" akan muncul berulang tanpa user minta.
        Reusable utk mutation background lain nanti (push on-write jg
        background, pola sama).
- [x] **Client fetch ke Worker** (2026-10-01,
      `shared/cloud-sync/worker-client.ts`) — wrapper HTTP tipis,
      TIDAK tahu kapan dipanggil (itu urusan hook push on-write/logic
      pull, BELUM dibuat), cuma tahu CARA memanggil endpoint Worker dgn
      benar. Semua fungsi terima `{ workerUrl, token }` eksplisit
      (bukan baca sendiri dari `useCloudSyncSettings`) — modul tetap
      murni/testable tanpa bergantung React Query/SQLite.
      - `testCloudSyncConnection()` — panggil `/health`, return
        boolean (TIDAK throw), utk tombol "Tes Koneksi".
      - `pushTransaction()`/`pushAccount()`/`pushAccountGroup()`/
        `pushCategory()`/`pushContact()` — UPSERT 1 baris, return
        `{status: 'ok'|'ignored'|'rejected', reason?}`. Status
        `'ignored'` dideteksi dari `message` response yg diawali
        `"Ignored:"` (kontrak informal dgn Worker, BUKAN field
        terstruktur — lihat catatan risiko di bawah). Status
        `'rejected'` HANYA utk HTTP 422 (validasi bisnis Worker
        menolak); error lain (500, dst) tetap di-throw sbg
        `WorkerRequestError`, TIDAK ditelan jadi 'rejected'.
      - `pullSync(creds, since)` — `since: null` → query kosong (Worker
        balas full snapshot). Bentuk `SyncResponse` SAMA PERSIS dgn
        `apps/worker/src/modules/sync/service.ts`.
      - **DIUJI 2 lapis**: (1) smoke test manual via Node thdp Worker
        PRODUCTION nyata (bukan mock) — health check, push create,
        push stale (ignored), pull (cek row muncul), delete — SEMUA
        skenario cocok persis dgn ekspektasi kontrak, data uji
        dibersihkan; (2) unit test formal
        `worker-client.test.ts` (13 test, `fetch` di-mock via
        `vi.stubGlobal`) — header Authorization, trailing-slash URL,
        deteksi 'ignored' dari message, 422→rejected vs error
        lain→throw, payload JSON body persis, `since` null vs terisi
        di query string. Full test suite desktop (166 test, 23 file)
        tetap 0 regresi setelah perubahan ini.
      - **Risiko kontrak informal DITEMUKAN & DITUTUP sebelum lanjut**:
        awalnya deteksi `'ignored'` pakai
        `message.startsWith("Ignored:")` (string matching thdp pesan
        bebas) — rapuh, diam-diam gagal kalau teks Worker berubah.
        **Diperbaiki 2026-10-01**: SEMUA controller endpoint tulis
        Worker (`transactions`, `accounts`, `account-groups`,
        `categories`, `contacts` — 8 titik di 5 file) diubah balas
        field terstruktur `{ status: "ignored", id }` di level JSON,
        BUKAN lagi dalam `message`. `worker-client.ts` diupdate cek
        `result.status === "ignored"` langsung. Worker di-redeploy &
        diverifikasi ulang di production (create→ignored dgn field
        eksplisit terkonfirmasi), test unit disesuaikan, full test
        suite (166 test) tetap 0 regresi.
- [x] **Section baru `content/cloud-sync/`** (2026-10-01,
      `features/settings/content/cloud-sync/` — `cloud-sync-section.tsx`
      (Card), `cloud-sync-form.tsx` (render murni), `use-cloud-sync-form.ts`
      (state+logic), pola dicontoh persis dari `retailku-integration/`.
      Toggle `<Switch>` EKSPLISIT (bukan implisit dari kelengkapan
      field). Help text tiap field sengaja jelasin DARI MANA nilainya
      (`wrangler deploy` output utk URL, secret `PC_SYNC_TOKEN` utk
      token) — fitur ini BUKAN layanan pihak ketiga yg bisa didaftar
      lewat form, murni "bawa Worker sendiri". Teks juga netral MCP
      (bukan nyebut nama asisten AI spesifik) krn MCP didukung lebih
      dari satu client.
- [x] **Tombol "Tes Koneksi"** — panggil `/health`, TANPA menulis.
- [x] **Logic pull saat app dibuka+online** (2026-10-01,
      `shared/cloud-sync/pull-sync.ts` + `use-pull-sync.ts`) —
      `useAutoPullSync()` dipasang SEKALI di `app/providers.tsx`
      (`CloudSyncBootstrap`), jalan sekali per sesi app terbuka kalau
      `cloud_sync_enabled`+kredensial lengkap. Per baris per tabel: LWW
      compare `updatedAt` masuk vs `updated_at` lokal (valid krn trigger
      `AFTER UPDATE` migrasi 0028 selalu ngisi `updated_at` lokal).
      **Keputusan desain**: `deletedAt` terisi dari Worker → HARD DELETE
      lokal (BUKAN simpan `deleted_at` apa adanya) — desktop TIDAK py
      SATU PUN query yang filter `deleted_at IS NULL`, jadi soft-delete
      mentah akan "hidup tapi tersembunyi setengah2" di semua list/
      laporan PC. Urutan apply ikut dependency FK. Checkpoint diupdate
      via `useSetCloudSyncCheckpoint` (silent) SETELAH pull sukses, lalu
      `queryClient.invalidateQueries()` penuh (data berubah di luar
      jalur mutation biasa). Best-effort, silently skip kalau offline/
      gagal (pola sama `useRetailkuMappingIssues`).
- [x] **Logic push ON-WRITE** (2026-10-01, `shared/cloud-sync/
      push-on-write.ts` + `push-row.ts`) — disisipkan ke **17 mutation
      hooks** (create/update/delete × account_groups/accounts/
      categories/contacts, create+update transactions — `transactions`
      delete SENGAJA DISKIP, Worker belum py endpoint DELETE, lihat Gap
      di bawah). `pushOnWrite()` dipanggil `void` (non-blocking, TIDAK
      di-await) stlh SQL lokal sukses — mutationFn tetap resolve cepat,
      push jalan di background. Baca kredensial LANGSUNG via SQL
      (`SELECT ... FROM settings`), BUKAN `useCloudSyncSettings()` (hook
      React Query tidak valid dipanggil di dalam `mutationFn`).
      **Keputusan delete**: push ke Worker SEBELUM hard-delete lokal
      (`await pushDeleteOnWrite(...)`, BUKAN `void`) — payload DELETE
      cuma butuh id, gagal/offline TIDAK memblokir delete lokal (resolve
      normal baik sukses maupun gagal→enqueue).
      - **Bug lama ditemukan & diperbaiki sambil lewat**: 3 dialog
        delete (`delete-account-group-dialog.tsx`,
        `use-delete-account-form.ts`, `delete-category-dialog.tsx`)
        masih panggil `Number(targetXxxId)` pada id yg sebenarnya UUID
        STRING sejak migrasi `0027_uuid_primary_keys.sql` — selalu kirim
        `NaN` ke SQL reassign (bug reassign account/account-group/
        category senyap sejak migrasi UUID). Tipe `DeleteAccountInput`/
        `DeleteAccountGroupInput`/`DeleteCategoryInput` (`targetXxxId`)
        diperbaiki dari `number` ke `string`, 3 caller-nya ikut
        diperbaiki.
- [x] **Retry/antrian push gagal** (2026-10-01, migrasi
      `0029_cloud_sync_queue.sql`+`0030_cloud_sync_queue_payload.sql`,
      tabel `cloud_sync_queue`, `shared/cloud-sync/push-queue.ts`). Isi
      antrian `{table, id, op}` — **BUKAN payload penuh** utk
      `op='upsert'` (baca ULANG row terbaru dari SQLite lokal saat
      retry, selalu dapat data terbaru). **Pengecualian WAJIB utk
      `op='delete'`**: kolom `payload` (JSON) menyimpan action
      reassign/unassign — row sudah hard-deleted lokal di titik enqueue,
      actionnya keputusan SESAAT user, tidak ada apa pun utk "dibaca
      ulang". `flushPushQueue()` dipanggil dari `retryPendingPushes()`
      di awal tiap `useAutoPullSync()` (SEBELUM pull, supaya perubahan
      lokal yg blm terkirim jalan duluan).
- [x] **Toggle OFF** — otomatis (bukan logic terpisah): `resolveCredentials()`
      di `push-on-write.ts` DAN `enabled` check di `use-pull-sync.ts`
      sama2 baca `cloud_sync_enabled` tiap panggilan — OFF → semua
      fungsi jadi no-op. Tidak ada aksi delete apa pun yg dipicu toggle,
      data D1 tidak tersentuh.

**Prasyarat sebelum Tahap 6 bisa mulai**: endpoint Worker WAJIB sudah
punya autentikasi PC↔Worker — SUDAH ADA (Bearer token `PC_SYNC_TOKEN`,
selesai sesi sebelumnya).

### Fitur TAMBAHAN ditemukan perlu saat verifikasi (2026-10-01, BUKAN di rencana awal)

- [x] **CORS di Worker** — Worker TIDAK PUNYA CORS middleware sama
      sekali sebelum sesi ini (semua tes sebelumnya lewat `curl`/Node
      script, bukan browser/WebView — celah ini tidak pernah ketahuan).
      DITEMUKAN saat klik "Tes Koneksi" pertama kali dari app
      sungguhan: `Access to fetch ... blocked by CORS policy`.
      **Diperbaiki**: `app.use("*", cors())` (Hono, izinkan SEMUA
      origin) di `apps/worker/src/index.ts` — aman krn SETIAP endpoint
      tulis/baca tetap wajib Bearer token, CORS cuma relevan utk
      browser. Origin Tauri WebView bisa beda2 (dev vs production
      build) jadi wildcard dipilih drpd whitelist spesifik. Di-deploy &
      diverifikasi (`Access-Control-Allow-Origin: *` di response
      preflight).
- [x] **Backfill manual "Sync Semua Data Sekarang"** (2026-10-01,
      `shared/cloud-sync/backfill-sync.ts`, tombol baru di
      `cloud-sync-form.tsx`) — **GAP ARSITEKTUR ditemukan saat
      verifikasi production nyata**: push-on-write cuma mengirim baris
      yg DITULIS SETELAH fitur aktif, data yg SUDAH lama ada di SQLite
      (5500+ transaksi, 116 kategori, dst) tidak pernah otomatis
      ter-push. Transaksi baru yg merujuk akun LAMA (blm pernah
      ter-push) ditolak Worker dgn `FOREIGN KEY constraint failed`.
      **Keputusan user**: tombol manual terpisah (BUKAN otomatis saat
      toggle ON) — user sadar kapan proses (bisa lama, push 1
      baris/network call) ini jalan. Urut FK: account_groups →
      categories → contacts → accounts → transactions, `debts`/
      `debt_payments` TIDAK di-push (sama spt push-on-write, SENGAJA
      SKIP). Best-effort per baris (satu gagal tidak hentikan sisanya),
      progress live via callback, idempotent (aman diulang).
      - **Bug KEDUA ditemukan SAAT backfill pertama jalan di production**:
        `categories` SELF-REFERENCING (`parent_id`) — `SELECT id FROM
        categories` TIDAK menjamin induk terkirim sebelum anak, 36 dari
        116 kategori gagal FK (+ efek domino ke ratusan transaksi yg
        pakainya) krn sub-kategori sempat ter-push duluan. **Diperbaiki**:
        `getCategoryIdsParentsFirst()` — push `parent_id IS NULL` dulu,
        baru `parent_id IS NOT NULL`. Diverifikasi di data nyata:
        hierarki cuma 2 level (tidak ada grandparent), jadi solusi 2-pass
        ini cukup (BUKAN solusi umum N-level).
      - **Hasil akhir backfill production**: 5764 terkirim, 25 ditolak
        Worker, 0 gagal. 25 yang ditolak = transaksi historis 2024-2025
        bertipe income/expense yg menyentuh akun `account_type='debt'`
        (aturan `violatesDebtAccountRule` BARU ada di Worker, desktop
        lama tidak pernah menolaknya) — **diterima sbg divergence
        historis** (keputusan user): data itu valid & tetap ada di PC,
        cuma tidak ikut tersinkron ke D1/HP, tidak dianggap bug.

## Verifikasi (sisi PC)

- [x] **Push PC→D1 real-time** — DIVERIFIKASI production nyata
      2026-10-01: transaksi "Test Sinkron" ditambah dari UI PC, muncul
      di D1 (`wrangler d1 execute --remote`) dalam hitungan detik tanpa
      aksi manual apa pun.
- [x] **Pull D1→PC** — DIVERIFIKASI production nyata 2026-10-01:
      transaksi "Test dari HP (simulasi)" di-INSERT manual ke D1 via
      `wrangler d1 execute` (mensimulasikan tool MCP/HP, krn
      `apps/mcp-server` belum ada), muncul otomatis di UI PC stlh
      restart app (lewat `useAutoPullSync`), lengkap dgn join nama akun
      yg benar.
- [ ] Uji skenario inti: tambah transaksi dari HP (via MCP sungguhan,
      bukan simulasi manual) SAAT PC mati → nyalakan PC → pastikan
      transaksi itu muncul setelah pull, TIDAK hilang. **Masih BLOCKED**
      oleh `apps/mcp-server` yang belum ada (Tahap 5).
- [ ] Uji skenario konflik: edit baris sama dari PC (offline dari
      internet, misal) dan dari HP hampir bersamaan → pastikan
      `updated_at` lebih baru yang menang, bukan silent corruption.
- [x] Uji constraint "PC tetap 100% offline-first" tidak regresi —
      SEMUA push-on-write dipanggil non-blocking (`void`, kecuali
      delete yg memang didesain tidak memblokir meski di-`await`), app
      tetap berfungsi normal tanpa internet (gagal → masuk antrian
      retry senyap, TIDAK pernah memblokir UI).
- [ ] Uji soft delete: hapus dari satu sisi, sisi lain sempat edit
      sebelum tahu — pastikan resolve masuk akal (bukan crash/data
      hilang tanpa jejak sama sekali). Perlu `DELETE /transactions/:id`
      dulu (belum ada, lihat Gap) utk kasus transactions.

## Gap yang TERSISA (per 2026-10-03, update sesi Tahap 5 skeleton)

Tahap 6 (integrasi klien PC) **SELESAI secara fungsional** — push
on-write, pull, retry queue, backfill, UI Settings semua diverifikasi
jalan di production nyata (push PC→D1 DAN pull D1→PC, dua arah).
**UPDATE 2026-10-03**: Tahap 5 (`apps/mcp-server`) sekarang SEBAGIAN
SELESAI (sisi baca) & SUDAH DI-DEPLOY ke production (Vercel), lihat
detail lengkap di `apps/worker/docs/todos/done/cloud-sync.md` bagian
"Tahap 5". Juga ditambah: section Settings PC "AI Assistant (MCP)"
(`features/settings/content/ai-assistant/`) — sebelumnya placeholder
kosong sejak 2026-09-22, sekarang diisi form URL+token server MCP
(murni simpan+tampilkan, PC TIDAK pernah memanggil mcp-server sendiri)
supaya user gampang copy-paste saat setup client MCP.

Sisa pekerjaan di luar scope sesi ini:

1. `DELETE /transactions/:id` — **SELESAI PENUH 2026-10-03** (Worker +
   PC, lihat `apps/worker/docs/todos/done/cloud-sync.md` "Progress
   implementasi" utk desain lengkap sisi Worker). **Sisi PC**:
   - `getTransactionDebtStatus()` (`shared/debts/use-transaction-debt-status.ts`)
     DIUBAH terima `db` sbg parameter (BUKAN lagi `getDb()` dipanggil di
     dalam) — **bug nyata ditemukan SAAT nulis unit test** (bukan dari
     baca kode): fungsi ini dipanggil dari `detachDebtForDeletedTransaction`
     yg terima `db` dari caller (`mutationFn`, tidak bisa pakai hook
     React), tapi diam-diam buka KONEKSI DB KEDUA via `getDb()` sendiri
     — 2 koneksi beda utk 1 operasi yg seharusnya pakai koneksi yg sama.
     Test pertama kali gagal dgn `ReferenceError: window is not defined`
     (Tauri IPC dipanggil di lingkungan test Node) — barulah ketahuan.
   - `detachDebtForDeletedTransaction()` baru (`shared/debts/apply-debt-transaction.ts`)
     — port PERSIS dari `detachDebtForDeletedTransaction` Worker: role
     `none` no-op, role `payment` hapus `debt_payments`+revert status,
     role `principal` SET NULL `transaction_id` (piutang/cicilan tetap
     utuh). 5 unit test baru (fake DB di-extend utk query/UPDATE yg
     belum dikenali sebelumnya), total 171 test (166 lama+5 baru) 0
     regresi.
   - `useDeleteTransaction` (`features/transactions/shared/hooks/`) —
     panggil `detachDebtForDeletedTransaction` LOKAL sebelum hard-delete
     (independen dari cloud sync), toast informatif tambahan SETELAH
     sukses kalau role bukan `none`. **Keputusan desain penting**:
     toast HARUS berbasis status LOKAL (SQLite PC), BUKAN response
     Worker (`debtInfo` dari push cloud) — gap yg sempat kelewat saat
     desain awal: kalau toast numpang ke response Worker, toast TIDAK
     PERNAH muncul buat user yg cloud sync-nya OFF/offline (mayoritas
     use-case, krn ini fitur opsional).
   - `pushDeleteTransactionOnWrite()` baru (`shared/cloud-sync/push-on-write.ts`)
     + `deleteTransactionCloud()` (`worker-client.ts`) — sinkronisasi ke
     Worker, TERPISAH dari logic lokal di atas (push SEBELUM hard-delete,
     pola sama 4 tabel lain, `debtInfo` hasil Worker DIABAIKAN di sisi
     PC krn sudah py sumber kebenaran lokal sendiri).
   - **DIVERIFIKASI end-to-end di `tauri dev` SUNGGUHAN** (bukan cuma
     unit test) — user buat transfer cash→akun debt (piutang baru) +
     transaksi cicilan parsial lewat UI asli, lalu hapus KEDUANYA satu
     per satu: toast informatif muncul tepat sesuai role, diverifikasi
     via query `finance.dev.db` (copy+WAL sesuai
     `docs/rules/checking-dev-database.md`) — hapus cicilan → baris
     `debt_payments` bersih terhapus, piutang induk tetap `ongoing`
     Rp100.000 tidak berubah; hapus principal (setelah cicilan sudah
     tidak ada, `hadPayments:false`) → `transaction_id` jadi NULL,
     `amount`/`status` piutang tidak tersentuh.
2. ~~Token MCP terpisah dari `PC_SYNC_TOKEN`~~ **DITUTUP 2026-10-03** —
   `MCP_SYNC_TOKEN` sudah ada & di-deploy (lihat
   `apps/worker/docs/todos/done/cloud-sync.md`). **TAPI** `sync_source`
   di endpoint2 spt `correct-balance` MASIH hardcode `'mcp'` — belum
   dibenahi jadi dinamis per token krn belum ada tool TULIS MCP
   sungguhan yg butuh itu. Prasyarat token-nya sendiri SUDAH beres.
3. `apps/mcp-server` (Tahap 5) — **SEBAGIAN SELESAI 2026-10-03**: 5 tool
   BACA + OAuth shim sudah jalan & diverifikasi di production (termasuk
   narik data produksi asli lewat `get_debt_summary`). **UPDATE SAMA
   HARI**: juga sudah DIVERIFIKASI via client MCP SUNGGUHAN (Claude
   Web, bukan cuma `curl` manual lagi) — connect berhasil, tool baca
   dipakai utk ringkas pemasukan/pengeluaran bulan berjalan dgn data
   asli, hasil cocok ekspektasi. **BELUM**: tool TULIS (daftar final
   belum diputuskan) — tanpa ini, mengelola data dari HP ("tambah/edit
   transaksi lewat Claude") masih belum bisa, baru sebatas "tanya/lihat
   data".
4. Uji skenario konflik nyata (edit baris sama dari 2 sisi hampir
   bersamaan) dan soft-delete cross-device — masih BLOCKED, perlu tool
   TULIS MCP (poin 3) jalan dulu utk skenario yang realistis (bukan
   simulasi satu sisi).
5. 25 transaksi historis yang ditolak Worker (lihat "diterima sbg
   divergence historis" di atas) — tidak urgent, TAPI kalau suatu saat
   mau ditutup, opsinya: ubah `account_type` akun terkait jadi `cash`,
   atau longgarkan aturan `violatesDebtAccountRule` di Worker utk data
   lama (belum diputuskan, sengaja dibiarkan terbuka).

## Terkait

- [`apps/worker/docs/todos/done/cloud-sync.md`](../../../../worker/docs/todos/done/cloud-sync.md)
  — dokumen UTAMA: keputusan desain lengkap (LWW, soft delete,
  `sync_source`), skema D1, endpoint Worker, autentikasi, roadmap
  Tahap 0/1/4/5/7, progress implementasi terkini.
- [`../done/mcp-server-business-logic-audit.md`](../done/mcp-server-business-logic-audit.md)
  — hasil audit LENGKAP logic bisnis `apps/desktop` yang wajib
  direplikasi ke Worker sebelum tool tulis MCP aktif. TETAP di sini
  (bukan pindah ke `apps/worker`) krn isinya murni audit kode desktop
  (file:baris spesifik), meski dipakai sbg checklist porting Worker.
- [`docs/todos/done/cloud-sync-mcp.md`](../../../../../docs/todos/done/cloud-sync-mcp.md) — index navigasi
  lintas-app di root repo.
- `docs/todos/done/mcp-server-for-claude.md` — riset paling awal,
  opsi hosting/autentikasi/tooling dasar (sudah usang, lihat ringkasan
  status di dokumen itu — rencana aktif sekarang ada di dokumen ini).
- `multi-device-sync-engine.md` — DISIMPAN utk nanti, kasus BERBEDA
  (mobile app nativ sungguhan, bukan tool MCP) — TAPI keputusan
  LWW/soft-delete di sana jadi RUJUKAN LANGSUNG utk dokumen
  `apps/worker` krn kasusnya mirip.
- `docs/rules/checking-dev-database.md` — prosedur verifikasi migrasi
  lokal PC (copy `.db`+`.db-wal`+`.db-shm`, jangan query file aktif
  langsung).
