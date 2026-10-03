# Cloud Sync Worker — Sync Dua-Arah PC ↔ D1 + CRUD via MCP

> Dipisah dari `apps/desktop/docs/todos/plan/mcp-server-cloud-mirror.md`
> (2026-09-30) — dokumen itu awalnya berisi keputusan lintas-app
> (desktop+worker+mcp-server) sekaligus, padahal lokasinya di
> `apps/desktop`. Sekarang dipecah: bagian yang jadi TANGGUNG JAWAB
> `apps/worker` (skema D1, endpoint, autentikasi PC↔Worker, hosting)
> ada DI SINI. Bagian yang jadi tanggung jawab PC (migrasi lokal,
> integrasi UI Settings) TETAP di dokumen `apps/desktop`. Lihat
> `docs/todos/plan/` di root repo utk index/navigasi lintas-app.

## Latar belakang

Kebutuhan intinya: kelola data keuangan dari HP lewat Claude Web + MCP
server, SEBELUM `apps/mobile` (masih skeleton kosong) sungguhan
dibangun. Worker ini adalah SATU-SATUNYA pintu tulis ke Cloudflare D1
— dipanggil dari 2 arah: PC (sync push/pull) dan (nanti) `apps/mcp-server`
(tool tulis atas nama Claude/HP).

**Kenapa BUKAN "satu penulis" sederhana**: D1 punya DUA sumber tulis
(PC dan MCP tool). PC push snapshot buta akan MENIMPA perubahan yang
baru dibuat dari HP — makanya butuh conflict resolution (LWW) beneran,
bukan sekadar mirror pasif.

**Kenapa terpisah dari rencana mobile-native**
(`apps/desktop/docs/todos/plan/multi-device-sync-engine.md`, DISIMPAN
utk nanti kalau `apps/mobile` mulai dibangun): kasus itu 2 aplikasi
penuh offline-first saling sync (device fisik bisa lama offline).
Kasus INI lebih sempit: PC ↔ D1, sisi kedua BUKAN aplikasi mandiri tapi
tool MCP yang SELALU online saat dipanggil, tidak py SQLite lokal
sendiri. Keputusan LWW/soft-delete di dokumen mobile-native jadi
RUJUKAN LANGSUNG di sini karena kasusnya mirip (dua sumber tulis).

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
- **PC WAJIB pull dari D1 SEBELUM push** (bukan snapshot buta) —
  supaya perubahan yg dibuat lewat MCP/HP sejak sync terakhir tidak
  hilang tertimpa. Alur per baris saat pull: bandingkan `updated_at`
  D1 vs lokal, yang lebih baru menang, terapkan ke lokal. Alur push:
  kirim baris lokal yg `updated_at`-nya lebih baru dari checkpoint
  sync terakhir (BUKAN snapshot penuh — snapshot penuh cuma valid
  kalau satu arah, sekarang dua arah butuh gerakan lebih presisi per
  baris).
- **Pemicu pull: saat app dibuka + online. Pemicu push: ON-WRITE**
  (BERBEDA dari pull) — begitu user tambah/edit/hapus data di PC,
  langsung push baris itu ke D1 saat itu juga (async, tidak blocking
  UI), kalau online. Kalau offline, masuk antrian lokal, dikirim saat
  online lagi. Alasan beda dari pull: window "PC punya data baru yg
  belum sampai ke D1" perlu sekecil mungkin (detik-menit, bukan jam)
  krn D1 sekarang bisa berubah dari HP KAPAN SAJA.
- **Soft delete relevan lagi** (`deleted_at`) — sama alasannya dgn
  `multi-device-sync-engine.md`: hard delete di satu sisi (PC hapus
  transaksi) sementara sisi lain (MCP) sempat UPDATE baris yg sama
  sebelum tahu terhapus → ambigu. Soft delete tetap bisa dibandingkan
  by timestamp.
- **`sync_source` per baris — disertakan**, tapi bentuknya beda dari
  `multi-device-sync-engine.md` (bukan UUID per install device fisik,
  cukup enum sederhana: `"pc"` vs `"mcp"`) — berguna utk audit ringan
  tanpa kompleksitas identitas device penuh (krn cuma ada 2 "sumber").
  **DINAMAI `sync_source`, BUKAN `source`** — `transactions`/`debts`
  SUDAH punya kolom `source` dgn makna beda sama sekali (asal data
  bisnis: `'manual'`/`'retailku_sync'`). Lihat skema di bawah.
- **Tool MCP CRUD setara operasi PC** — bukan cuma tool baca, tapi
  tool tulis yg logic-nya SEPADAN dgn validasi yg sudah ada di app
  desktop. Ini berarti sebagian LOGIC BISNIS dari `src/features/*` app
  desktop perlu di-port/direplikasi ke Worker — lihat
  [`../../../../desktop/docs/todos/plan/mcp-server-business-logic-audit.md`](../../../../desktop/docs/todos/plan/mcp-server-business-logic-audit.md)
  utk daftar lengkap (dokumen itu TETAP di `apps/desktop` krn isinya
  audit kode desktop — file:baris spesifik di sana — meski dipakai
  sbg checklist porting ke Worker ini).
- **Cloudflare D1** (bukan Turso) — Turso wajib ganti driver DB dari
  `sqlx` ke `libsql`, LWW tidak built-in, roadmap masih pre-1.0 per
  riset 2026-09-30. D1 = SQLite juga, skema PC tidak perlu diterjemahkan.
- **Vercel Hobby + `mcp-handler`** utk hosting `apps/mcp-server`, OAuth
  shim di atas API key statis utk autentikasi Claude↔MCP server (lihat
  "Riset autentikasi & hosting" di bawah).

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
│ SQLite lokal PC      │                          │ apps/worker (Cloudflare)│
│ (apps/desktop)       │                          │ endpoint tulis, panggil │
│ TETAP offline-first, │                          │ D1 langsung (native     │
│ sync ke D1 opsional  │                          │ binding)                │
└──────────────────────┘                          └─────────────┬───────────┘
                                                                  │
                                                        ┌─────────▼─────────┐
                                                        │ apps/mcp-server   │
                                                        │ (Vercel) ← Claude │
                                                        └────────────────────┘
```

PC tetap 100% bisa dipakai offline. Worker adalah SATU-SATUNYA yang
menulis ke D1 — dipanggil dari PC (sync) DAN dari `apps/mcp-server`
(tool tulis, bukan langsung akses D1) supaya validasi logic bisnis
terpusat di satu tempat.

## Riset autentikasi & hosting

- **Hosting `apps/mcp-server`: Vercel Hobby**, package **`mcp-handler`**
  (Next.js App Router) — isolasi penuh dari server bisnis Retailku,
  Rp0 utk skala personal.
- **Autentikasi Claude↔MCP server: OAuth shim di atas API key statis**
  — diverifikasi dari implementasi LIVE MCP Retailku (`Warung Aqil`) di
  `D:\Programming\Pribadi\retail-multitenant\apps\api\src\app\mcp\`.
  Claude Web mewajibkan alur discovery OAuth
  (`.well-known/oauth-protected-resource`, `/register`,
  `/oauth/authorize`, `/oauth/token`), tapi di baliknya cukup satu form
  HTML "masukkan API key" — `access_token` yg dikembalikan ya API key
  itu sendiri (di-hash utk validasi), `expires_in` di-set sangat
  panjang. Utk `financial-app`, LEBIH SEDERHANA drpd Retailku krn
  single-user: satu token env var, tanpa tabel database.
- **Akses D1 baca dari `apps/mcp-server`: langsung via REST API**
  (`POST https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query`,
  `Authorization: Bearer <CLOUDFLARE_API_TOKEN>`), rate limit 1200
  req/5menit per akun — jauh cukup utk skala personal, TIDAK perlu
  Worker perantara utk baca.
- **Akses D1 tulis**: TETAP lewat `apps/worker` (native binding, bukan
  REST API) — dipanggil dari PC (sync push) DAN dari `apps/mcp-server`
  (kalau tool tulis MCP tidak langsung akses D1 REST API, tapi lewat
  Worker jg utk konsistensi logic validasi — lihat "Yang belum
  diputuskan").

- [x] **Endpoint create+update utk `account_groups`, `categories`,
      `contacts`** (2026-10-01, modul baru `src/modules/account-groups/`,
      `src/modules/categories/`, `src/modules/contacts/`):
      - **Riset dulu**: `debts`/`debt_payments` TERNYATA tidak punya
        padanan create/update LANGSUNG di desktop — form "tambah
        utang/piutang" (`use-create-debt.ts`) dan "bayar"
        (`use-pay-debt.ts`) SELALU lewat insert `transactions` (transfer)
        + `applyDebtTransaction`, sudah ter-cover endpoint `POST/PATCH
        /transactions` yg ada. **Keputusan: SKIP endpoint `/debts` &
        `/debt-payments` langsung** — menambahnya berarti membuat jalur
        BARU yg tidak ada di desktop (duplikasi logic FIFO/validasi di
        luar `applyDebtTransaction`), bukan porting. Tool MCP/PC cukup
        pakai `/transactions` dgn `debtAction` yg sesuai.
      - `account_groups` — port PERSIS `use-create-account-group.ts` +
        `use-update-account-group.ts`, entity paling sederhana (cuma
        `name`).
      - `categories` — port PERSIS `use-create-category.ts` +
        `use-update-category.ts`. **SENGAJA TANPA validasi baru**
        "parent.type === type" — desktop sendiri TIDAK memvalidasi ini
        di level schema/hook (cuma filter dropdown UI), port apa adanya
        konsisten dgn prinsip "logic ditulis ulang PERSIS, bukan
        ditambah" — DIVERIFIKASI: create child dgn `type` beda dari
        parent tetap 201 (BUKAN bug, keputusan sadar).
      - `contacts` — port PERSIS `use-create-contact.ts` +
        `use-update-contact.ts`, PLUS `resolveContactId()` (get-or-create
        exact match case-insensitive, port dari `resolve-contact.ts`) —
        diekspor dari `contacts/service.ts` utk dipakai modul LAIN
        nanti (mis. kalau endpoint `debts` manual akhirnya dibuat) sbg
        PEMICU, pola "modul pemilik vs pemicu". **BELUM ada entry point
        HTTP yg memanggilnya** (konsisten dgn keputusan skip
        `/debts` manual di atas) — fungsi sudah ada, tinggal dipakai
        begitu dibutuhkan.
      - **DIVERIFIKASI end-to-end di production** dgn data uji nyata:
        create+update+404-not-found+400-invalid-payload utk ketiga
        modul, termasuk cek eksplisit `is_active=false` tersimpan `0` di
        D1. Data uji sudah dibersihkan (0 baris tersisa).

- [x] **Endpoint `DELETE` utk `account_groups`, `accounts`, `categories`,
      `contacts`** (2026-10-01):
      - **Keputusan desain** (dikonfirmasi user): endpoint terima field
        aksi EKSPLISIT per relasi, PERSIS pola desktop (BUKAN satu
        `reassignTo` opsional) — mis. `{ memberAction: "unassign" |
        "reassign", targetGroupId?: string }` utk `account_groups`.
        Kalau field aksi tidak dikirim sama sekali, TIDAK ada UPDATE
        apa pun dijalankan (sama persis perilaku desktop).
      - `account_groups` — `memberAction`/`targetGroupId` (relasi:
        `accounts.group_id`).
      - `accounts` — `transactionAction`/`targetAccountId`, menangani
        DUA kolom sekaligus (`transactions.account_id` DAN
        `transfer_account_id`), PERSIS urutan `use-delete-account.ts`.
      - `categories` — DUA relasi independen:
        `childAction`/`targetParentId` (`categories.parent_id`) DAN
        `transactionAction`/`targetCategoryId`
        (`transactions.category_id`).
      - `contacts` — **TANPA payload sama sekali** (beda dari 3 lainnya)
        — `use-delete-contact.ts` TIDAK py reassign/unassign eksplisit
        apa pun, langsung delete, FK `ON DELETE SET NULL` yg
        menangani (di desktop, hard delete).
      - **Temuan arsitektur BARU** (ditemukan saat verifikasi, bukan
        dari audit awal): soft delete (`deleted_at`, Worker) BEDA
        perilaku dari hard delete (desktop) utk kasus `contacts` —
        krn FK `ON DELETE SET NULL` cuma terpicu kalau baris BENAR2
        dihapus, soft-delete `contacts` MENINGGALKAN
        `transactions.contact_id` tetap menunjuk ke kontak yg sudah
        `deleted_at` (TIDAK auto-NULL spt di desktop).
        **DIVERIFIKASI eksplisit**: delete kontak via endpoint → query
        JOIN transaksi+kontak membuktikan `contact_id` TETAP terisi
        walau `contacts.deleted_at` sudah terisi. **BELUM diputuskan**
        apakah ini perlu ditangani (tambah unassign eksplisit di Worker,
        beda dari desktop) atau diterima sbg keterbatasan soft-delete —
        TIDAK urgent krn `contact_id` cuma dipakai di laporan ringkasan
        kontak, bukan formula saldo/debt.
      - **DIVERIFIKASI end-to-end di production** dgn data uji nyata:
        reassign account_group (anggota pindah grup, grup lama
        `deleted_at` terisi); unassign account (`account_id` jadi NULL
        di transaksi terkait); reassign child category + unassign
        transaction category BARENG dalam satu request; delete contact
        tanpa body; 404 utk entity tidak ada; 400 utk payload invalid
        (`memberAction` bukan `"unassign"`/`"reassign"`). Data uji sudah
        dibersihkan (0 baris tersisa).
      - **Catatan terpisah**: `accounts` SAAT INI belum py endpoint
        create/update (`POST /accounts`, `PATCH /accounts/:id`) — hanya
        `balance`, `correct-balance`, dan sekarang `DELETE` yg ada.
        `use-create-account.ts`/`use-update-account.ts` di desktop ADA
        tapi belum di-port — gap terpisah, BUKAN bagian scope delete
        ini.

- [x] **Endpoint create+update utk `accounts`** (2026-10-01, menutup gap
      yg ditemukan sesi sebelumnya — `accounts` cuma py `balance`,
      `correct-balance`, `DELETE`): port PERSIS `use-create-account.ts`
      + `use-update-account.ts`, TIDAK ADA validasi bisnis non-trivial
      (cuma required `name`). `color` default `"slate"` di form desktop
      (`DEFAULT_ACCOUNT_COLOR`, konstanta kosmetik UI) — Worker biarkan
      `null` kalau caller tidak kirim, BEDA kecil dari desktop yg SELALU
      isi default, SENGAJA krn caller non-UI (tool MCP) wajar tidak
      peduli warna. **DIVERIFIKASI end-to-end di production**: create →
      cek `GET /accounts/balance` return `initialBalance` yg sama
      (bukti integrasi lintas endpoint); update (termasuk `isActive:
      false`) → cek D1 langsung, semua field tersimpan benar;
      404-not-found; 400-invalid-payload. Data uji sudah dibersihkan.

- [x] **UPSERT + LWW beneran utk SEMUA endpoint tulis** (2026-10-01) —
      sebelumnya SEMUA endpoint cuma INSERT/UPDATE polos, `updated_at`
      selalu ditulis baru TANPA dibandingkan dgn baris existing (push
      dari PC bisa menimpa perubahan dari HP tanpa conflict resolution
      apa pun). Helper generik baru `shared/lww.ts`
      (`decideLww`/`resolveIncomingUpdatedAt`/`nowText`/`isValidUpdatedAt`),
      dipakai SEMUA modul tulis (`transactions`, `accounts`,
      `account-groups`, `categories`, `contacts`).
      - **Keputusan desain** (dikonfirmasi user, urutan): (1) scope
        dipersempit ke "LWW check di endpoint existing" dulu, endpoint
        pull (`GET /sync?since=`) BELUM dikerjakan (prematur sebelum
        Tahap 6/PC py mekanisme memanggilnya); (2) `POST` jadi UPSERT
        LWW-aware JUGA (bukan cuma `PATCH`) — kalau `id` ternyata sudah
        ada, treat spt update (bandingkan `updatedAt`), BUKAN error
        primary-key-constraint; (3) format `updatedAt` payload: TEXT
        `"YYYY-MM-DD HH:mm:ss"` sama persis dgn kolom `updated_at`
        (string-compare valid krn zero-padded), opsional — tidak
        dikirim berarti server pakai `now()` sendiri (backward
        compatible, SELALU "menang" krn pasti paling baru); (4) `id`
        WAJIB dari caller utk `account_groups`/`categories`/`contacts`/
        `accounts` (BREAKING change — sebelumnya server-generate
        `uuidv7()`) supaya UPSERT bisa tahu row mana yg dimaksud tanpa
        pull dulu, konsisten dgn pola `transactions` yg sudah terima
        `id` dari awal & `uuid-migration.md`; (5) LWW menang CLEAR
        `deleted_at` juga (row yg soft-deleted "hidup lagi" kalau sisi
        lain edit dgn `updatedAt` lebih baru — semantik LWW murni,
        timestamp yg menang menang sepenuhnya termasuk status
        hidup/mati); (6) `POST`/`PATCH` TETAP dua2nya ada (bukan
        disederhanakan jadi satu `PUT`) — caller bebas pilih yg paling
        natural, semantik keduanya SAMA (upsert LWW), TIDAK breaking
        thd kontrak endpoint yg sudah diverifikasi sesi2 sebelumnya.
      - **`transactions` PALING kompleks** — cek LWW dilakukan PALING
        AWAL, SEBELUM validasi bisnis apa pun (#4, #3, #2, dst)
        dijalankan (keputusan eksplisit: payload stale tidak perlu
        divalidasi, percuma). `insertTransaction` (POST) di-refactor:
        kalau `id` sudah ada → delegasi ke `updateTransactionRow`
        (fungsi internal yg SAMA dipakai jalur PATCH, supaya logic #1/
        #2/#3/#7 tidak terduplikasi) — bukan cuma logic #1/#4 spt kalau
        dipanggil manual terpisah.
      - **Bug ditemukan & diperbaiki SAAT verifikasi (bukan dari desain)**:
        skenario awal "UPSERT menang" sempat mengembalikan `id` BARU
        (uuidv7) alih2 meng-update row existing — ternyata root cause-nya
        deploy sebelumnya belum sinkron (Version ID berubah lagi stlh
        redeploy eksplisit), BUKAN bug logic. Setelah redeploy & retest,
        semua skenario lolos.
      - **DIVERIFIKASI end-to-end di production**, skenario lengkap:
        create baru; UPSERT dgn `updatedAt` LEBIH LAMA → diabaikan
        (dicek row TIDAK berubah di D1); UPSERT dgn `updatedAt` LEBIH
        BARU → menang (dicek row BERUBAH sesuai payload baru, `id`
        TETAP SAMA bukan row baru); un-delete via LWW win (soft-delete
        dulu → UPSERT menang → `deleted_at` jadi NULL lagi, dicek
        eksplisit di D1); PATCH jg diuji LWW stale+menang (bukan cuma
        POST); **regresi 0** utk logic bisnis #1 (FIFO debt, transfer
        cash→debt tetap bikin piutang benar) & #4 (larangan akun debt
        tetap 422) di jalur UPSERT baru; spot-check `contacts`/
        `categories`/`accounts` sama2 lolos pola stale+menang. Data uji
        sudah dibersihkan (0 baris tersisa).
- [x] **Endpoint pull `GET /sync?since=`** (2026-10-01, modul baru
      `src/modules/sync/`) — satu endpoint gabungan, balas SEMUA 7
      tabel sekaligus dalam satu response (keputusan: PC selalu pull
      semua tabel bareng, tidak ada skenario "cuma mau tabel tertentu").
      - **Keputusan desain** (dikonfirmasi user): (1) `since` opsional,
        format TEXT sama persis dgn `updated_at` (`"YYYY-MM-DD
        HH:mm:ss"`); (2) `since` KOSONG = first sync = **full snapshot
        SEMUA baris** (termasuk yg `deleted_at` terisi) — awalnya
        ditanya soal biaya D1, dijelaskan biaya dihitung dari ROWS READ
        bukan ukuran response, dan skala personal (ribuan baris bukan
        jutaan) jauh di bawah limit free tier, PLUS ini cuma terjadi
        SEKALI (first sync), bukan pola berulang tiap app-open —
        diputuskan lanjut full snapshot, JANGAN over-engineer dari awal
        utk kasus yg blm tentu jadi masalah; (3) field response
        camelCase (`accountId`, `updatedAt`, dst), KONSISTEN dgn payload
        endpoint tulis — supaya PC bisa reuse field yg sama kalau mau
        push ulang baris ini tanpa mapping manual.
      - `checkpoint` di response = waktu Worker MEMPROSES request
        (diambil SEBELUM query jalan, bukan sesudah) — PC simpan nilai
        ini utk pull berikutnya, hindari celah "baris berubah PAS SAAT
        query berjalan" ter-skip di pull selanjutnya.
      - Filter `updated_at > since` (STRICT greater-than, bukan `>=`) —
        baris dgn `updated_at` SAMA PERSIS dgn `since` TIDAK ikut
        (sudah pernah diterima di pull sebelumnya yg menghasilkan
        checkpoint itu).
      - **DIVERIFIKASI end-to-end di production**: full snapshot (tanpa
        `since`) mengembalikan SEMUA baris termasuk yg soft-deleted
        dgn `deletedAt` terisi; incremental pull dgn `since` di antara
        dua baris beda `updated_at` cuma balas yg lebih baru; boundary
        `since` SAMA PERSIS dgn `updated_at` suatu baris → baris itu
        TIDAK ikut (strict `>` terverifikasi); 400 utk format `since`
        invalid; 401 tanpa token; semua 7 key tabel + `checkpoint`
        terverifikasi ada di response. Data uji sudah dibersihkan.
      - **BELUM dikerjakan**: sisi PC yg MEMANGGIL endpoint ini (simpan
        checkpoint lokal, terapkan baris masuk ke SQLite lokal dgn LWW
        compare, trigger saat app dibuka+online) — itu scope Tahap 6,
        BELUM disentuh sama sekali di `apps/desktop`.
- [x] **Kontrak response `"ignored"` diperbaiki jadi field terstruktur**
      (2026-10-01, ditemukan saat bangun fondasi client PC di Tahap 6)
      — SEMUA endpoint tulis (`transactions`, `accounts`,
      `account-groups`, `categories`, `contacts`) awalnya balas status
      LWW-ignored via `{ status: "ok", message: "Ignored: existing row
      is newer (LWW)" }` (pesan bebas di `message`, BUKAN field
      terstruktur) — rapuh utk caller otomatis (PC/MCP) yg butuh
      deteksi reliable, bukan cuma ditampilkan ke user. Diubah jadi
      `{ status: "ignored", id }` di level JSON. Redeploy & diverifikasi
      ulang di production, 0 regresi di endpoint lain.

## Yang BELUM diputuskan

- [ ] **Arsitektur tool tulis MCP**: apakah `apps/mcp-server` akses D1
      langsung (REST API, tulis manual dgn `updated_at`+validasi di
      kode Vercel), ATAU tool tulis MCP memanggil `apps/worker` yg SAMA
      dipakai PC utk sync (supaya logic validasi/`updated_at` terpusat
      di satu tempat, tidak dobel-tulis di Vercel & Worker). Condong ke
      opsi kedua (logic terpusat) tapi belum final.
- [x] ~~(a) reassign/unassign saat delete account/category/account-group~~
      — **DIPUTUSKAN & DI-IMPLEMENTASI 2026-10-01**: WAJIB terima
      parameter aksi eksplisit, PERSIS pola desktop. Lihat "Progress
      implementasi" bagian endpoint `DELETE`.
- [ ] **2 open question tersisa** dari audit logic bisnis (detail di
      `mcp-server-business-logic-audit.md`, bagian "Perlu keputusan
      desain eksplisit"): (b) guard delete transaksi terhadap
      debt/payment terkait — SAAT INI tidak ada sama sekali bahkan di
      desktop, dibiarkan atau ditambah di kedua sisi sekalian?; (c)
      definisi tunggal formula `remaining`/`balance` (shared util/VIEW)
      dibuat SEBELUM porting ke Worker, atau di-port apa adanya per
      lokasi (risiko drift diterima)?
- [ ] **BARU**: soft-delete `contacts` tidak auto-unassign
      `transactions.contact_id` (beda dari hard-delete desktop) — lihat
      temuan lengkap di "Progress implementasi". Perlu diputuskan apakah
      ditangani atau diterima sbg keterbatasan.
- [ ] Daftar tool CRUD fase pertama & urutan prioritas — draft awal py
      5 tool BACA (`get_account_balances`, dst) — perlu diperluas dgn
      tool TULIS, belum diputuskan mana yg paling mendesak.
- [ ] Nama/struktur endpoint Worker (`/sync` masih working name;
      `/transactions` sudah ada tapi DEVELOPMENT ONLY, lihat
      "Progress implementasi" di bawah).
- [ ] DI MANA token OAuth-shim/API key (Claude↔MCP server) disimpan &
      di-generate.
- [ ] Bentuk token PC↔Worker (terpisah dari OAuth-shim MCP) — belum
      ada sama sekali, endpoint `/transactions` saat ini TANPA
      autentikasi (development only).

## Keputusan yang sudah ditutup (dari open question sebelumnya)

- [x] ~~Skema kolom sync (`updated_at`, `deleted_at`, `source`) — reuse
      persis atau terpisah dari `multi-device-sync-engine.md`?~~ —
      DIPUTUSKAN 2026-09-30: **SEBAGIAN reuse, bukan reuse persis, bukan
      terpisah total**.
      - `updated_at` & `deleted_at` — **identik** (nama kolom, tipe,
        semantik LWW) dgn `multi-device-sync-engine.md`. Alasan: kedua
        kolom ini ADALAH mekanisme LWW itu sendiri — kalau nanti mobile
        native jadi dan menulis ke tabel D1 yg SAMA dgn yg dipakai MCP,
        format `updated_at` yg beda antar rencana akan merusak
        perbandingan LWW lintas sumber.
      - Kolom identitas sumber — **TETAP beda**: `sync_source` (enum
        `"pc"`/`"mcp"`) di sini, BUKAN `device_id` (UUID per install)
        spt `multi-device-sync-engine.md`. Alasan: `device_id` didesain
        utk N device fisik yg tak diketahui jumlahnya — tidak masuk
        akal utk tool MCP yg dipanggil ulang tiap request dari Claude.
- [x] ~~Inventarisir logic bisnis yang perlu di-port ke server~~ —
      SELESAI, lihat
      [`mcp-server-business-logic-audit.md`](../../../../desktop/docs/todos/plan/mcp-server-business-logic-audit.md)
      utk daftar lengkap (7 logic risiko TINGGI wajib, +5 keputusan
      desain risiko SEDANG).
- [x] Logic bisnis DITULIS ULANG di Worker (bukan diekstrak jadi shared
      logic dgn `apps/desktop`) — beda runtime total (React+SQLite
      lokal vs Cloudflare Worker+D1), tidak realistis dibagi kode
      langsung. Port manual per fungsi, risiko drift diterima.

## Progress implementasi

- [x] **Provisioning D1**: database `financial-app` (region APAC) sudah
      dibuat via `wrangler d1 create`, `database_id` tertulis di
      `wrangler.toml`.
- [x] **Skema D1**: `schema/0001_initial.sql` — 7 tabel replika skema PC
      (`account_groups`, `categories`, `contacts`, `accounts`,
      `transactions`, `debts`, `debt_payments`) + kolom sync
      (`updated_at`/`deleted_at`/`sync_source`). TANPA trigger
      auto-`updated_at` (beda dari PC) — Worker SELALU mengisi
      `updated_at` eksplisit di tiap tulis, supaya logic LWW dikontrol
      presisi oleh Worker, bukan auto-generate DB. **DIVERIFIKASI
      ter-apply ke D1 remote asli** (`wrangler d1 execute financial-app
      --file=schema/0001_initial.sql --remote`, dicek via CLI + D1
      Studio: ketujuh tabel ada).
- [x] **Endpoint `POST /transactions`** (`src/index.ts`) — terima 1
      baris transaksi, INSERT ke D1 dgn `sync_source='pc'`. Proteksi
      autentikasi SUDAH ADA (lihat poin autentikasi di bawah), TAPI
      **MASIH BELUM ADA validasi logic bisnis dari audit** (FIFO debt,
      larangan akun `debt` utk income/expense, dst) — JANGAN dipakai
      dari integrasi PC sungguhan atau tool MCP tulis manapun sebelum
      validasi itu ditambahkan. Juga BELUM menangani UPDATE/DELETE,
      cuma INSERT polos (belum UPSERT dgn LWW). **DIVERIFIKASI
      end-to-end di PRODUCTION** (bukan cuma `wrangler dev`): payload
      valid + token benar → 201 + tersimpan benar di D1; payload cacat
      → 400 ditolak; tanpa/token salah → 401 ditolak (data uji sudah
      dihapus lagi).
- [x] **Endpoint `GET /health`** — cek koneksi D1 hidup, return daftar
      tabel yang ada, TANPA autentikasi (disengaja — tidak sensitif).
      Ditemukan: `sqlite_version()` DIBLOKIR D1 (`SQLITE_ERROR code
      7500`, "not authorized to use function") — pakai query
      `sqlite_master` sbg gantinya utk cek konektivitas.
- [x] **Autentikasi PC↔Worker**: token statis Bearer (`PC_SYNC_TOKEN`),
      dicek di `isAuthorized()` sebelum endpoint tulis apa pun jalan.
      (2026-10-03: `isAuthorized()` kemudian diperluas terima token
      KEDUA, `MCP_SYNC_TOKEN`, utk `apps/mcp-server` — lihat entri
      terpisah di bawah, BUKAN mengubah perilaku token ini.)
      Disimpan sbg Cloudflare secret (`wrangler secret put
      PC_SYNC_TOKEN`), TIDAK di `wrangler.toml`. Token production
      digenerate via `openssl rand -hex 32` (32-byte random, bukan
      dipilih manual) — token yg SAMA nantinya dipakai sbg
      `cloud_sync_token` di tabel `settings` PC (Tahap 6). **CATATAN
      TOOLING PENTING**: `wrangler dev --remote` TIDAK meneruskan
      `.dev.vars` ke Worker yg jalan di edge remote (env var jadi
      `undefined` walau ringkasan binding menampilkan "(hidden)" —
      terverifikasi via endpoint debug sementara, lalu dihapus lagi)
      — sedangkan `wrangler dev` TANPA `--remote` membaca `.dev.vars`
      dgn benar TAPI D1-nya jadi simulasi lokal kosong (bukan D1 remote
      asli). Makanya verifikasi penuh (auth + D1 asli sekaligus) HARUS
      lewat deploy sungguhan (`wrangler deploy`), bukan `wrangler dev`
      dalam mode apa pun. **DIVERIFIKASI di URL production asli**
      (`https://financial-app-worker.muhamadaqil383.workers.dev`) — 4
      skenario lolos: `/health` tanpa auth (200), POST tanpa header
      (401), POST token salah (401), POST token benar (201 + baris
      tersimpan benar, sudah dibersihkan lagi).
- [x] **Worker sudah di-deploy** ke Cloudflare (bukan cuma preview
      `wrangler dev` lagi) — URL:
      `https://financial-app-worker.muhamadaqil383.workers.dev`.
- [x] **Struktur kode dirapikan per-modul** (`controller`/`service`/
      `schema` per resource, `src/index.ts` jadi router murni) — lihat
      `apps/worker/docs/rules/module-structure.md` utk aturan & alasan
      lengkap. Termasuk keputusan pola "modul pemilik vs modul pemicu"
      utk logic lintas-tabel (mis. FIFO debt dipicu dari `transactions`
      tapi dimiliki `debts`).
- [x] **Migrasi routing ke Hono** (REVISI dari keputusan awal "manual
      if/else") — dipicu kebutuhan path dinamis pertama
      (`/transactions/:id` utk endpoint update, belum dibuat). Tiap
      modul sekarang py `router.ts` (sub-app Hono), `index.ts` jadi
      induk yg `.route(prefix, subApp)`. Controller diubah terima
      `Context` Hono langsung (bukan `request`+`env` terpisah). Lihat
      `apps/worker/docs/rules/module-structure.md` utk pola lengkap.
      **DIVERIFIKASI regresi penuh di production setelah migrasi** —
      SEMUA endpoint existing (health, auth 401, formula saldo, FIFO
      debt, larangan akun debt, koreksi saldo) dites ulang dgn hasil
      IDENTIK sebelum migrasi, 0 regresi.
- [x] **Modul `accounts` + logic #5 & #6 dari audit di-port**
      (`src/modules/accounts/`):
      - `getAccountBalance()` — port PERSIS formula saldo dari
        `use-accounts.ts` (`SELECT_ACCOUNTS_WITH_BALANCE`), termasuk
        arah tanda transfer. BEDA dari query asli: filter
        `deleted_at IS NULL` ditambah SEJAK AWAL (soft delete belum
        dipakai di kode manapun, tapi aman krn semua baris NULL
        sekarang — begitu Tahap 6 mulai soft-delete, formula ini
        otomatis benar).
      - `correctAccountBalance()` — port dari
        `use-correct-account-balance.ts`: get-or-create kategori
        "Penyesuaian Saldo" per type, no-op kalau diff=0. BEDA dari
        desktop: `currentBalance` DIHITUNG ULANG di Worker (panggil
        `getAccountBalance()` sendiri), TIDAK dipercaya dari client
        (beda dari desktop yg terima dari cache React Query).
      - Endpoint: `GET /accounts/balance?accountId=`, `POST
        /accounts/correct-balance`. Pakai `uuidv7` package (SAMA
        dgn `apps/desktop/src/lib/id.ts`) utk generate ID, TERBUKTI
        kompatibel dgn Cloudflare Worker runtime (belum pernah
        divalidasi sebelumnya).
      - `sync_source` transaksi/kategori hasil endpoint ini di-hardcode
        `'mcp'` (SEMENTARA, ada `TODO` di kode) — endpoint ini bukan
        hasil push dari PC. Begitu token MCP terpisah dari
        `PC_SYNC_TOKEN` dibuat, WAJIB diganti jadi derive dari jenis
        token yg dipakai request (JANGAN percaya `sync_source` dari
        body payload client, bisa dipalsukan).
      - **DIVERIFIKASI end-to-end di production** dgn akun uji nyata:
        saldo awal benar (`initial_balance` tanpa transaksi), koreksi
        `+50000` menghasilkan transaksi `income` yg tepat + kategori
        auto-created dgn `type` benar, saldo setelah koreksi benar,
        panggilan ulang dgn target sama → `no_change` (bukan transaksi
        duplikat). Data uji sudah dibersihkan.
- [x] **Modul `debts` + logic #1 & #4 dari audit di-port**
      (`src/modules/debts/service.ts`, plus perubahan di
      `src/modules/transactions/service.ts`):
      - `applyDebtTransaction()` — port PERSIS dari
        `apply-debt-transaction.ts`: transfer cash→debt = piutang baru
        otomatis; transfer debt→cash = WAJIB `debtAction` eksplisit
        (`'payable'`/`'settlement'`); debt→debt/cash→cash = no-op.
        Dipanggil dari `transactions/service.ts` (modul PEMICU) SETELAH
        insert `transactions` berhasil — pola "modul pemilik vs
        pemicu" dari `module-structure.md`.
      - `settleDebtsFifo()` (private, dipanggil dari dalam
        `applyDebtTransaction`) — urutkan `debts` by `date ASC, id ASC`,
        alokasikan `amount` sampai habis per debt, insert
        `debt_payments`, set `status='paid'` kalau alokasi menutup
        sisa penuh.
      - **Logic #4** (larangan income/expense di akun `debt`) — DI SINI
        jadi VALIDASI KERAS (HTTP 422 reject), BEDA dari desktop yg
        auto-correct via `useEffect` di form (Worker tidak punya UI utk
        "otomatis ganti pilihan user", cuma bisa terima/tolak).
      - Payload `POST /transactions` diperluas: `debtAction`,
        `settleDebtIds` (opsional, cuma relevan utk transfer debt→cash).
      - **DIVERIFIKASI end-to-end di production** dgn akun cash+debt uji
        nyata, 4 skenario: (1) expense ke akun debt → 422 ditolak;
        (2) transfer cash→debt → piutang baru `type=receivable` benar;
        (3) settlement parsial (60rb dari 100rb) → `debt_payments`
        tercatat benar, status TETAP `ongoing`; (4) settlement sisa
        (40rb) → status berubah jadi `paid` tepat saat lunas. Data uji
        sudah dibersihkan (0 baris tersisa di 4 tabel terkait).
      - **BELUM di-port** (status SEBELUM sesi 2026-10-01): #2 (guard
        edit) & #3 (validasi pelunasan ≤ sisa) — keduanya baru relevan
        begitu ada endpoint UPDATE transaksi (belum ada, baru create).
        **Lihat bagian "Endpoint `PATCH /transactions/:id` + 3 logic
        sisa" di bawah — KETIGANYA sudah di-port di sesi 2026-10-01.**
- [x] **Endpoint `PATCH /transactions/:id` + 3 logic sisa (#2, #3, #7)
      dari audit di-port** (2026-10-01,
      `src/modules/transactions/service.ts` fungsi `updateTransaction()`,
      `src/modules/debts/service.ts` fungsi baru):
      - **#7 `dangerousFieldsChanged`** — port PERSIS dari
        `use-update-transaction.ts`: field type/accountId/
        transferAccountId/amount/contactId dibandingkan terhadap NILAI
        LAMA transaksi (`ExistingTransactionRow`, di-query dulu sebelum
        update). Field lain (note/date/description) tidak pernah
        trigger recreate debt.
      - **#2 guard edit (`DebtEditBlockedError`)** — port PERSIS dari
        `apply-debt-transaction.ts` (`applyDebtTransactionEdit`):
        `getTransactionDebtStatus()` (versi Worker query D1 langsung,
        BUKAN dari cache spt `use-transaction-debt-status.ts` di
        desktop) resolve role transaksi (`none`/`principal`/`payment`)
        SEBELUM UPDATE jalan — kalau `principal` + field berbahaya
        berubah + `hasPayments`, REJECT 422 SEBELUM baris `transactions`
        di-update sama sekali (bukan recreate-lalu-gagal).
      - **#3 validasi pelunasan ≤ sisa** — **CELAH DITUTUP**: fungsi
        baru `validateDebtSettlementAmount()` di `debts/service.ts`
        dipanggil sbg PRE-CHECK sebelum INSERT/UPDATE baris
        `transactions` (baik dari `insertTransaction` maupun
        `updateTransaction`), REJECT 422 KERAS kalau `amount` > total
        `remaining` debts terpilih — **beda dari audit awal** (yg
        menduga reject terjadi "di dalam" FIFO, setelah data tertulis):
        pre-check dipindah ke SEBELUM tulis apa pun supaya atomic (lihat
        temuan atomicity di bawah). `settleDebtsFifo` SENDIRI tetap
        divalidasi ulang (defense-in-depth, dipanggil dari 2 jalur:
        create & edit).
      - **Temuan atomicity BARU** (ditemukan saat implementasi, BUKAN
        dari audit asli): `insertTransaction`/`updateTransaction`
        awalnya akan INSERT/UPDATE baris `transactions` DULU baru
        panggil `applyDebtTransaction` (yg bisa reject krn #3) — kalau
        reject terjadi SETELAH tulis, baris transaksi/update sudah
        terlanjur tersimpan tanpa FIFO settlement-nya (tidak atomic). D1
        Workers Binding `batch()` TIDAK cocok sbg solusi krn FIFO butuh
        baca-remaining-dulu-baru-tentukan-tulis (dua fase, bukan
        statement tetap). **Solusi dipilih**: semua pre-check (#3, #2,
        #4) dijalankan SEBELUM statement INSERT/UPDATE `transactions`
        apa pun — pola yg SAMA dgn #4 (`violatesDebtAccountRule`) yg
        sudah lebih dulu ada. DIVERIFIKASI eksplisit: reject #3 dgn
        `amount` jauh melebihi sisa → 0 baris `transactions` tersimpan;
        reject #2 → `transactions.amount` TETAP nilai lama (tidak
        ter-update sebagian).
      - Endpoint: `PATCH /transactions/:id` (`transactions/router.ts`,
        `transactions/controller.ts` `handlePatchTransaction`). 404
        kalau transaksi tidak ada/sudah `deleted_at`.
      - **DIVERIFIKASI end-to-end di production** dgn akun+kontak uji
        nyata, 6 skenario: (1) PATCH field aman (note) → 200, debt tidak
        tersentuh; (2) PATCH field berbahaya (amount) pada `principal`
        BELUM dicicil → 200, debt RECREATE (id baru, amount baru
        terverifikasi di D1); (3) PATCH field berbahaya pada `principal`
        SUDAH dicicil (insert manual 1 `debt_payments`) → 422 blocked,
        `transactions.amount` terverifikasi TETAP nilai lama; (4) POST
        transfer settlement dgn `amount` jauh > sisa piutang → 422
        rejected, 0 baris `transactions` tersimpan (atomicity
        terverifikasi); (5) POST transfer settlement dgn `amount` PAS =
        sisa → 201 ok, `debts.status` terverifikasi jadi `'paid'`; (6)
        PATCH transaksi id tidak ada → 404. Data uji sudah dibersihkan
        (0 baris tersisa di 5 tabel terkait, terverifikasi via COUNT
        query).
- [x] **`MCP_SYNC_TOKEN` — token MCP terpisah dari `PC_SYNC_TOKEN`**
      (2026-10-03, menutup gap yg dicatat di akhir sesi Tahap 6) —
      `Env.MCP_SYNC_TOKEN` baru (`shared/env.ts`), `isAuthorized()`
      terima KEDUA token (`token === PC_SYNC_TOKEN || token ===
      MCP_SYNC_TOKEN`). Disimpan sbg Cloudflare secret terpisah
      (`wrangler secret put MCP_SYNC_TOKEN`), digenerate random 32-byte
      hex sama spt pola `PC_SYNC_TOKEN` (`openssl rand -hex 32` tidak
      tersedia di PowerShell user — dipakai `RandomNumberGenerator`
      .NET sbg gantinya, hasil setara crypto-secure).
- [x] **`sync_source` dinamis per token** (2026-10-03, sesi implementasi
      tool TULIS MCP) — menutup gap yg dicatat di atas. `resolveSyncSource()`
      baru (`shared/auth.ts`) derive `"pc"|"mcp"` dari token yg dipakai
      request, di-set ke Hono Context (`AppContext`) oleh `requireAuth`,
      diteruskan controller→service sbg argumen eksplisit — TIDAK PERNAH
      dari body payload client. Semua 9 titik hardcode (`transactions`
      pakai `'pc'`, `accounts`/`account-groups`/`categories`/`contacts`/
      `debts` pakai `'mcp'`) diganti bind dinamis. UPDATE statement tidak
      disentuh (kolom ini cuma diisi saat INSERT).
- [x] **`GET /auth/verify`** (2026-10-03, `src/index.ts`) — endpoint
      ringan khusus validasi token (PC_SYNC_TOKEN ATAU MCP_SYNC_TOKEN),
      `requireAuth` lalu balas `{ok:true}` TANPA sentuh D1 sama sekali.
      Dibutuhkan krn tidak ada endpoint existing yg cocok dipakai utk
      "cek token valid, tanpa efek samping" (semua endpoint tervalidasi
      lain adalah operasi data atau `/sync` yg bisa berat) — dipakai
      `apps/mcp-server` saat proses OAuth authorize utk verifikasi
      token yg dimasukkan user, SEBELUM code exchange terjadi.
      **DIVERIFIKASI di production**: tanpa token → 401, token salah →
      401, `PC_SYNC_TOKEN` ATAU `MCP_SYNC_TOKEN` yg benar → 200
      `{"ok":true}`.
- [x] **`apps/mcp-server` — Tahap 5 DIMULAI & deployed** (2026-10-03,
      lihat detail lengkap di bagian "Tahap 5" di bawah) — skeleton
      Next.js App Router + `mcp-handler`, OAuth shim custom, 5 tool
      BACA. **DIVERIFIKASI end-to-end di PRODUCTION SUNGGUHAN** (bukan
      cuma lokal): deployed ke Vercel
      (`https://financial-tracker-mcp-server.vercel.app`), full OAuth
      flow (register → authorize dgn token production → PKCE token
      exchange) lolos, `tools/list` menampilkan 5 tool, `tools/call`
      `get_debt_summary` berhasil narik DATA PRODUKSI NYATA dari Worker
      (98 piutang berjalan, total Rp36.137.014) — bukan data uji.
- [x] **`DELETE /transactions/:id`** (2026-10-03,
      `transactions/service.ts` `deleteTransaction()` +
      `debts/service.ts` `detachDebtForDeletedTransaction()`) — soft
      delete (`deleted_at`), pola sama endpoint DELETE lain. **Keputusan
      desain** (dibahas bareng user, BUKAN "guard yang memblokir" spt
      draft awal "Yang BELUM diputuskan" — direvisi jadi UX yang
      mempermulus): tindakan TUNGGAL per role dari
      `getTransactionDebtStatus()` (SUDAH ADA, dipakai jg di jalur
      PATCH), TIDAK ADA payload pilihan dari client sama sekali (beda
      dari `DeleteAccountPayload` yg py `transactionAction` opsional):
      - `role: 'none'` — hapus langsung, tanpa efek samping.
      - `role: 'payment'` — hapus `debt_payments` terkait + revert
        `debts.status` ke `'ongoing'` kalau sempat `'paid'` krn
        pembayaran yg baru dihapus ini (logic SAMA PERSIS dgn cabang
        `applyDebtTransactionEdit` role='payment' field berubah, di-port
        jadi fungsi sendiri `detachDebtForDeletedTransaction` spy tidak
        duplikasi).
      - `role: 'principal'` (BAIK sudah maupun belum dicicil, SAMA
        tindakannya) — `debts.transaction_id` SET NULL, BUKAN DELETE
        `debts`. Piutang/cicilan TETAP UTUH scr nominal (`remaining`
        dihitung dari `debts.amount - SUM(debt_payments)`, independen
        dari `transaction_id`) — cuma kehilangan jejak "transaksi mana
        yg jadi asal". **Alasan desain**: awalnya dipikir perlu tolak
        keras (422) kalau `hasPayments`, TAPI nominal piutang tidak
        bergantung sama sekali ke `transaction_id`-nya (beda dari kasus
        EDIT yg emang berbahaya krn bisa UBAH nominal) — jadi SET NULL
        aman utk kedua sub-kasus, tidak perlu split jadi 2 keputusan.
      - Response `{status, id, debtInfo: {role, ...}}` — PC (task
        menyusul) pakai `debtInfo` ini utk tampilkan pesan SETELAH
        delete berhasil (dialog tetap 1 tombol konfirmasi generik dulu,
        BUKAN "cek dulu baru hapus" 2 round-trip — keputusan sadar,
        krn PC py SQLite lokal sendiri shg bisa cek `getTransactionDebtStatus`
        versi lokal SEBELUM render dialog kalau nanti mau pesan
        spesifik di awal, tanpa perlu network call ke Worker).
      - **DIVERIFIKASI 4 skenario lokal** (akun+kontak+debt uji nyata
        lewat endpoint HTTP, bukan INSERT manual, supaya
        `applyDebtTransaction` beneran generate baris `debts`/
        `debt_payments`): (1) delete transaksi biasa → `debtInfo:
        {role:'none'}`; (2) delete transaksi payment/cicilan →
        `debt_payments` terhapus, `debts.amount`/`transaction_id`
        tidak tersentuh; (3) delete transaksi principal TANPA cicilan
        → `transaction_id` NULL, `hadPayments:false`; (4) delete
        transaksi principal DENGAN cicilan existing → `transaction_id`
        NULL, `hadPayments:true`, `debt_payments` (cicilan dari
        transaksi LAIN) **TIDAK ikut terhapus/tersentuh**. Error case:
        id tidak ada/sudah soft-deleted → 404, tanpa token → 401. Data
        uji sudah dibersihkan.

## Todo list eksekusi

### Tahap 0 — Riset arsitektur dasar — SELESAI

- [x] Hosting: Vercel Hobby + `mcp-handler` utk `apps/mcp-server`.
- [x] Autentikasi Claude↔MCP: OAuth shim di atas API key statis.
- [x] Akses D1 baca: langsung REST API dari Vercel.
- [x] Akses D1 tulis: lewat Worker, native binding.

### Tahap 1 — Keputusan conflict resolution — SELESAI

- [x] Strategi: last-write-wins sederhana via `updated_at`.
- [x] Soft delete (`deleted_at`) relevan lagi, dipakai.
- [x] `sync_source` sederhana (`"pc"` vs `"mcp"`), bukan UUID device.
- [x] Pemicu pull: saat app dibuka+online. Pemicu push: on-write.

### Tahap 3 (bagian Worker) — Skema D1 — SELESAI

- [x] Skema D1 = replika skema lokal PC + kolom sync yang sama, lihat
      "Progress implementasi" di atas. (Bagian migrasi PC ada di
      dokumen `apps/desktop`.)

### Tahap 4 — Cloudflare: Worker + D1 — SEDANG BERJALAN

- [x] Provisioning 1 database D1.
- [x] Endpoint tulis pertama (`POST /transactions`) — lihat "Progress
      implementasi" utk detail scope (baru INSERT, belum UPSERT/LWW).
- [x] Endpoint `PATCH /transactions/:id` (2026-10-01) — lihat "Progress
      implementasi" utk detail. Masih INSERT/UPDATE polos (belum
      UPSERT/LWW), belum DELETE.
- [x] Autentikasi PC↔Worker (token terpisah dari OAuth-shim MCP) —
      token statis Bearer, lihat "Progress implementasi". Worker sudah
      DI-DEPLOY ke production (bukan cuma preview dev lagi).
- [x] Push UPSERT dgn LWW per baris — SELESAI 2026-10-01, lihat
      "Progress implementasi".
- [x] Endpoint pull (`GET /sync?since=`) — SELESAI 2026-10-01, lihat
      "Progress implementasi". Sisi Worker LENGKAP; sisi PC yg
      memanggilnya BELUM (Tahap 6).
- [x] Endpoint create+update utk `account_groups`, `categories`,
      `contacts` — lihat "Progress implementasi" utk detail.
      **SENGAJA SKIP** `/debts` & `/debt-payments` langsung (tidak py
      padanan di desktop, lihat alasan lengkap di "Progress
      implementasi").
- [x] Endpoint DELETE utk `account_groups`/`accounts`/`categories`/
      `contacts` — SELESAI 2026-10-01, lihat "Progress implementasi".
- [x] Endpoint `DELETE /transactions/:id` (soft delete) — SELESAI
      2026-10-03, lihat "Progress implementasi" utk keputusan desain
      lengkap + hasil verifikasi.
- [x] Endpoint create+update utk `accounts` — SELESAI 2026-10-01, lihat
      "Progress implementasi".
- [x] Validasi/logic bisnis hasil audit diimplementasikan di Worker —
      lihat checklist porting di `mcp-server-business-logic-audit.md`.
      **PROGRESS: 7 dari 7 SELESAI** (2026-10-01). #1 FIFO debt, #4
      larangan akun debt (modul `debts`+`transactions`, endpoint `POST
      /transactions`); #5 formula saldo, #6 koreksi saldo (modul
      `accounts`); #2 guard edit, #3 validasi pelunasan ≤ sisa, #7
      `dangerousFieldsChanged` (endpoint `PATCH /transactions/:id`,
      lihat "Progress implementasi" utk detail lengkap). **CELAH #3
      SUDAH DITUTUP** — client TIDAK perlu lagi validasi sendiri,
      Worker reject 422 keras sebelum tulis apa pun.

### Tahap 5 — MCP server (Vercel) — SELESAI (baca + tulis)

- [x] **Setup Next.js App Router + `mcp-handler`** (2026-10-03,
      `apps/mcp-server`) — App Router polos (`src/app`), paket
      `mcp-handler@^2` + `@modelcontextprotocol/server@^2` (BUKAN
      `@modelcontextprotocol/sdk@^1` yg dipakai Retailku — nama paket
      beda, versi 2.x dari Vercel sendiri, cocok dipasang langsung di
      route Next.js tanpa `StreamableHTTPServerTransport` manual spt
      NestJS). `GET /api/mcp` dibungkus `withMcpAuth` bawaan paket ini
      (BUKAN guard custom spt `McpApiKeyGuard` Retailku) — `verifyToken`
      callback-nya panggil `GET /auth/verify` ke Worker.
- [x] **OAuth shim** (2026-10-03) — ADAPTASI pola Retailku
      (`mcp-oauth.controller.ts`/`mcp-auth.guard.ts`), BUKAN port 1:1:
      - `app/register/route.ts`, `app/oauth/authorize/route.ts` (form
        HTML minta token, bukan API key — divalidasi via `GET
        /auth/verify` ke Worker, bukan query DB spt Retailku),
        `app/oauth/token/route.ts` (PKCE S256 + tukar code, access_token
        yg dibalikin = TOKEN WORKER ITU SENDIRI, pola passthrough SAMA
        persis Retailku).
      - `app/.well-known/oauth-authorization-server/route.ts` — custom
        kecil (kita authorization server-nya sendiri).
      - `app/.well-known/oauth-protected-resource/route.ts` — PAKAI
        `protectedResourceHandler` BAWAAN `mcp-handler` (Retailku
        handcode ini manual, paket Vercel sudah sediakan siap pakai).
      - **Keputusan sadar soal storage code OTP**: in-memory `Map`
        (`src/lib/oauth-store.ts`), SAMA spt Retailku — BUKAN Cloudflare
        KV/Vercel KV meski risiko gagal di lingkungan serverless
        (instance beda antar-request) nyata. Diterima krn flow ini cuma
        terjadi SEKALI per setup koneksi client MCP (bukan tiap request
        harian), gagal → user tinggal ulang authorize. Upgrade ke KV
        kalau ternyata sering gagal di praktik.
      - **DIVERIFIKASI full flow di PRODUCTION**: register → authorize
        (token production asli, BUKAN dummy) → redirect dgn `code` →
        PKCE token exchange (S256, `code_verifier` dicocokkan) → 200
        `access_token`. Juga diverifikasi reject case: `code_verifier`
        hilang → 400, token salah saat authorize → 401 + form error.
- [x] **Tool BACA — 5 tool draft awal SEMUA SELESAI** (2026-10-03,
      `app/api/mcp/route.ts` + `src/lib/sync-snapshot.ts`): saldo akun
      (`get_account_balances`), ringkasan pengeluaran per kategori
      (`get_expense_summary_by_category`), list transaksi
      (`list_transactions`), ringkasan utang piutang
      (`get_debt_summary`), riwayat per kontak (`get_contact_history`).
      **Keputusan desain**: SEMUA tool manggil `GET /sync` (snapshot
      PENUH, endpoint yg SUDAH ADA) lalu filter/agregasi di
      `apps/mcp-server` sendiri — BUKAN nambah endpoint baca baru di
      Worker (mis. `GET /transactions?filter=`) sekarang. Alasan: scope
      lebih kecil utk skeleton awal, snapshot `/sync` sudah include
      SEMUA field yg dibutuhkan tiap tool, endpoint Worker baru per
      kebutuhan laporan bisa menyusul kalau performa jadi masalah nyata
      (snapshot makin besar seiring data bertambah). Formula saldo akun
      DIDUPLIKASI persis dari `accounts/service.ts`
      `getAccountBalance()` (bukan panggil endpoint itu per-akun —
      N+1 request utk "semua akun" lebih mahal dari 1x `/sync` lalu
      hitung lokal). **DIVERIFIKASI nyata**: `tools/list` production
      menampilkan ke-5 tool dgn schema benar (auto-generate dari Zod);
      `tools/call get_debt_summary` berhasil narik DATA PRODUKSI ASLI
      (98 piutang berjalan, Rp36.137.014) lewat Worker.
- [x] **Tool TULIS — RISET 2026-10-03, IMPLEMENTASI + VERIFIKASI SELESAI
      2026-10-03 (sesi terpisah, sesuai permintaan user)**. 16 tool
      terpisah per aksi per tabel (keputusan: granularitas per aksi,
      BUKAN 1 tool generik dgn parameter `action`), semua lewat
      `apps/mcp-server/src/app/api/mcp/route.ts` → `workerFetch` →
      endpoint Worker yg sudah ada (tidak ada endpoint baru di Worker):
      - **transactions**: `create_transaction`, `update_transaction`,
        `delete_transaction`.
      - **accounts**: `create_account`, `update_account`,
        `delete_account`, `correct_account_balance` (tool terpisah,
        bukan bagian update_account, krn semantik beda total).
      - **account_groups**: `create_account_group`,
        `update_account_group`, `delete_account_group`.
      - **categories**: `create_category`, `update_category`,
        `delete_category`.
      - **contacts**: `create_contact`, `update_contact`,
        `delete_contact`.
      Total 21 tool (5 baca + 16 tulis), DIVERIFIKASI terdaftar lengkap
      via `tools/list` production.

      **3 keputusan desain dari riset, final**:
      1. **Resolusi `contactName`** — Worker resolve otomatis via
         `resolveContactId()` (sudah ada di `contacts/service.ts`, kini
         disambungkan). `transactions/schema.ts` terima `contactName?`
         opsional sbg alternatif `contactId` (`contactId` eksplisit
         SELALU menang). Resolusi terjadi di
         `createTransactionRow`/`updateTransactionRow`
         (`transactions/service.ts`) SEBELUM dipakai di SQL bind & input
         `applyDebtTransaction`/`applyDebtTransactionEdit` — termasuk di
         `dangerousFieldsChanged` (bandingkan `resolvedContactId`, bukan
         `payload.contactId` mentah, supaya ganti kontak via nama juga
         kena deteksi field berbahaya yg benar).
      2. **`sync_source` dinamis** — lihat entry terpisah di atas
         ("Progress implementasi").
      3. **Konfirmasi delete** — SEMUA tool `delete_*` di mcp-server
         wajib `confirm: z.literal(true)`. Worker TIDAK berubah sama
         sekali (tetap tidak kenal parameter `confirm`) — safety-net ini
         sengaja cuma di level yg mengizinkan LLM memicu aksi destruktif,
         bukan bagian kontrak API Worker.

      **DIVERIFIKASI end-to-end di PRODUCTION** via protokol MCP
      sungguhan (`tools/call` JSON-RPC, bukan curl langsung ke Worker):
      `create_transaction` dgn `contactName` baru → kontak otomatis
      terbuat & `contactId` tersambung benar (dicek balik via
      `list_transactions`); `delete_transaction` TANPA `confirm` →
      direject Zod SEBELUM request sampai Worker (pesan error dari
      mcp-server, bukan dari Worker); `delete_transaction` DENGAN
      `confirm:true` → sukses. Juga diverifikasi di Worker lokal
      (`wrangler dev` + curl + query SQLite langsung) sblm deploy: akun/
      kontak/debt/debt_payments yg dibuat via token MCP tersimpan
      `sync_source='mcp'`, via token PC tersimpan `'pc'` (SEBELUMNYA
      transactions SELALU hardcode `'pc'` apa pun tokennya); `contactId`
      eksplisit menang atas `contactName`; regresi existing (debt
      settlement melebihi sisa → 422, akun debt violation → 422, DELETE
      transaction dgn debtInfo) semua masih berjalan benar. Worker
      production di-deploy ulang (`wrangler deploy`) sebelum verifikasi
      end-to-end, SEMUA data uji coba dibersihkan setelahnya (soft-delete
      akun/kategori/kontak test di production).

      Inventaris riset asli (sblm implementasi) dipertahankan di bawah
      ini sbg referensi historis keputusan yg diambil:

      **Endpoint Worker yang SUDAH ADA dan tiap tool tulis TINGGAL
      memanggilnya (tidak perlu endpoint baru)**:
      - `transactions`: `POST /`, `PATCH /:id`, `DELETE /:id` — ketiganya
        lengkap, termasuk field `debtAction`/`settleDebtIds` utk
        transfer yg menyentuh akun `debt`, dan penanganan
        piutang/utang terkait saat delete (lihat
        `docs/concept/konsep-utang-piutang.md`).
      - `accounts`: `POST /`, `PATCH /:id`, `DELETE /:id` (dgn
        `transactionAction`/`targetAccountId`), `POST /correct-balance`,
        `GET /balance`.
      - `account_groups`, `categories`, `contacts`: masing-masing
        `POST /`, `PATCH /:id`, `DELETE /:id` (dgn opsi reassign/
        unassign eksplisit yg relevan).

      **Temuan arsitektural PENTING yg mempengaruhi desain tool "catat
      utang"/"bayar utang"**: TIDAK ADA endpoint `/debts` atau
      `/debt-payments` di Worker sama sekali (dikonfirmasi langsung dari
      `src/index.ts` — cuma 6 router yg di-mount: transactions, accounts,
      account-groups, categories, contacts, sync). Ini BUKAN celah yg
      kelewat — SENGAJA begitu krn desktop sendiri pun TIDAK py endpoint
      terpisah utk ini (`use-create-debt.ts`/`use-pay-debt.ts` di
      desktop cuma kemudahan UI, di baliknya SELALU membuat transaksi
      transfer biasa lewat `applyDebtTransaction`). Jadi tool MCP
      "catat piutang baru" dan "bayar piutang" **WAJIB** diimplementasi
      sbg pemanggilan `POST /transactions` dgn `type: "transfer"` +
      `debtAction` + `settleDebtIds` yg sesuai — BUKAN endpoint/tool
      terpisah yg seolah "/debts" punya API sendiri.

      **Temuan kedua — gap kecil yg perlu diputuskan sebelum tool
      "tambah transaksi" dibuat**: `resolveContactId()` (get-or-create
      kontak by nama, case-insensitive) SUDAH di-port penuh ke
      `modules/contacts/service.ts`, TAPI **belum disambungkan ke
      endpoint HTTP manapun** — `POST/PATCH /transactions` saat ini
      HANYA terima `contactId` yg sudah berupa ID final, tidak resolve
      dari nama. Ini relevan krn tool MCP yg dipanggil Claude akan
      menerima nama kontak dlm bahasa natural ("bayar utang ke Budi"),
      bukan ID — PERLU DIPUTUSKAN saat implementasi: (a) tool MCP
      terima `contactName` lalu Worker resolve via `resolveContactId`
      sebelum insert transaksi (perlu ubah endpoint `/transactions`
      utk terima `contactName` opsional sbg alternatif `contactId`),
      ATAU (b) tool MCP wajib py tool BACA "cari/list kontak" dulu utk
      dapat ID-nya, baru panggil tool tulis dgn `contactId` (2 panggilan
      tool, tidak ubah kontrak `/transactions`).

      **Yang TIDAK masuk scope tool TULIS** (sesuai cakupan tool BACA
      yg sudah ada, konsisten "MCP cuma urus data keuangan inti"):
      attachment (`transaction_attachments`) — tidak py endpoint Worker
      sama sekali, dan memang di luar jangkauan D1 (file fisik di disk
      lokal PC) — kalau nanti dibutuhkan, itu scope terpisah di luar
      tool TULIS fase ini.

      **Keputusan yg diambil di SESI IMPLEMENTASI (2026-10-03, sesi
      terpisah dari riset) — semua 4 poin di atas SUDAH DIPUTUSKAN &
      diimplementasikan, lihat ringkasan lengkap di entry "Tool TULIS"
      di atas**:
      1. Daftar final tool tulis & prioritas → tool terpisah per aksi
         per tabel (BUKAN digabung dgn parameter `action`), semua 5
         tabel sekaligus (16 tool total).
      2. Resolusi kontak by name → opsi (a): Worker resolve `contactName`
         otomatis via `resolveContactId`.
      3. `sync_source` dinamis per token → selesai, lihat entry
         terpisah di "Progress implementasi".
      4. Validasi tambahan khusus MCP → tool `delete_*` wajib
         `confirm: z.literal(true)` di level mcp-server, Worker tidak
         berubah.

### Tahap 7 — Verifikasi (sisi Worker/MCP) — DITUTUP 2026-10-03

**Keputusan sadar**: skenario di bawah TIDAK diuji lewat test
formal/simulasi buatan. Setelah tool TULIS MCP (Tahap 5) selesai, user
memutuskan ini cukup ketahuan natural lewat dogfooding (pakai aplikasinya
sehari-hari dari PC+HP) — temuan nyata dicatat manual di
`Catatan Penggunaan.txt` (root repo) kapan pun muncul, bukan checklist
test terpisah yang harus dikerjakan preemptive.

Skenario yang tadinya direncanakan (dipertahankan sbg referensi kalau
nanti ada temuan terkait dari dogfooding):
- Tambah transaksi dari HP (via Claude/MCP) SAAT PC mati → nyalakan PC
  → pastikan transaksi itu muncul setelah pull, TIDAK hilang.
- Konflik: edit baris sama dari PC (offline) dan dari HP hampir
  bersamaan → pastikan `updated_at` lebih baru yang menang, bukan
  silent corruption.
- Validasi bisnis dari sisi MCP: operasi yg SEHARUSNYA ditolak lewat
  tool MCP, pastikan Worker MENOLAK juga, bukan cuma divalidasi di
  client PC.
- Soft delete: hapus dari satu sisi, sisi lain sempat edit sebelum tahu
  — pastikan resolve masuk akal.

(Tahap 2 — inventarisir logic bisnis, dan Tahap 6 — integrasi klien PC,
ada di dokumen `apps/desktop/docs/todos/plan/mcp-server-cloud-mirror.md`.)

## Terkait

- [`../../../../desktop/docs/todos/plan/mcp-server-cloud-mirror.md`](../../../../desktop/docs/todos/plan/mcp-server-cloud-mirror.md)
  — dokumen sisi PC: latar belakang fitur, titik integrasi UI Settings,
  migrasi lokal, Tahap 6 (integrasi klien PC).
- [`../../../../desktop/docs/todos/plan/mcp-server-business-logic-audit.md`](../../../../desktop/docs/todos/plan/mcp-server-business-logic-audit.md)
  — checklist LENGKAP logic bisnis yang wajib di-port ke Worker ini
  sebelum endpoint tulis dianggap aman dipakai sungguhan.
- [`../../../../../docs/todos/plan/cloud-sync-mcp.md`](../../../../../docs/todos/plan/cloud-sync-mcp.md) — index
  navigasi lintas-app di root repo.
- `apps/desktop/docs/todos/plan/mcp-server-for-claude.md` — riset
  paling awal, opsi hosting/autentikasi/tooling dasar (masih berlaku).
- `apps/desktop/docs/todos/plan/multi-device-sync-engine.md` —
  DISIMPAN utk nanti, kasus BERBEDA (mobile app nativ sungguhan) — TAPI
  keputusan LWW/soft-delete di sana jadi RUJUKAN LANGSUNG di sini.
- `D:\Programming\Pribadi\retail-multitenant\apps\api\src\app\mcp\` —
  implementasi LIVE rujukan pola OAuth shim.
