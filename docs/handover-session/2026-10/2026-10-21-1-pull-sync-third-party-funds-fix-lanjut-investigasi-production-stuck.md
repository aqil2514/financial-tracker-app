# Handover — 2026-10-21 (sesi 1)

Lanjutan sesi fitur "Dana Pihak Ketiga" (Tahap 1-5 sudah selesai & deploy
production di sesi sebelumnya — lihat
[docs/todos/done/third-party-sync.md](../../todos/done/third-party-sync.md)).
Sesi ini dipicu laporan user: data yang diinput lewat MCP tool
`create_third_party_fund_direct` ke **production** tidak pernah terbawa
turun ke desktop. Satu bug ditemukan dan diperbaiki (pull-sync gap), tapi
setelah fix di-build ulang dan dites user LANGSUNG DI PRODUCTION BUILD
(bukan `tauri dev`), data MASIH tidak masuk. Investigasi mendalam
dilakukan tapi **root cause penyebab kedua ini BELUM ketemu** — sesi
berakhir di tengah investigasi.

## Ringkasan hasil sesi (kronologis)

### 1. Bug pertama ditemukan & diperbaiki — pull-sync gap untuk `third_party_funds`

User: *"Nah, memang saya yang input. Masalahnya, ada di ketika pull. Di
sisi desktop tidak ambil semuanya"*.

Ditelusuri: `applySyncResponse` di
[apps/desktop/src/shared/cloud-sync/pull-sync/index.ts](../../../apps/desktop/src/shared/cloud-sync/pull-sync/index.ts)
— satu-satunya orkestrator yang menyalurkan tiap koleksi `SyncResponse`
ke tabel lokalnya — **tidak punya cabang untuk `thirdPartyFunds` sama
sekali**. Tahap 3 (sesi sebelumnya) hanya mewiring arah PUSH
(desktop→Worker), arah PULL (Worker→desktop) terlupa total.

Ironisnya, proyek ini sudah punya regression test
([pull-sync.test.ts](../../../apps/desktop/src/shared/cloud-sync/test/pull-sync.test.ts))
yang didesain KHUSUS untuk mencegah kelas bug ini (judulnya sendiri
menyebut "regresi investment_* yang dulu terlupa" — insiden identik
pernah terjadi untuk tabel investment). Tapi karena fixture-nya manual
(harus diupdate tiap koleksi baru ditambah), tidak otomatis gagal —
`tsc` sempat memberi compile error saat field ditambahkan ke tipe Worker,
tapi tidak pernah dijalankan ulang di titik itu pada sesi Tahap 4.

**Fix** (commit `ac361f4`):
- `thirdPartyFunds` ditambahkan ke tipe `SyncResponse` desktop
  ([worker-client/pull-sync.ts](../../../apps/desktop/src/shared/cloud-sync/worker-client/pull-sync.ts))
- `pull-sync/upsert-third-party-fund.ts` dibuat (pola sama
  `upsert-investment-purchase.ts`)
- Loop baru di `applySyncResponse`
- `pull-sync.test.ts` diupdate (fixture + assertion `touchedTables`)

Typecheck bersih, test lulus, sudah di-commit.

### 2. Verifikasi end-to-end — user pakai PRODUCTION BUILD, bukan dev

User mengoreksi asumsi saya: yang sedang dites bukan `tauri dev`/
`wrangler dev` seperti pola dogfooding biasa proyek ini, tapi **Worker
production** + **desktop hasil build** (installer, bukan dev server).
User sudah build ulang (`src-tauri/target/release/desktop.exe`,
`.msi`/NSIS setup — timestamp 19:54-19:55), install ulang, tutup app
lama total lewat Task Manager, buka lagi — **tapi data tetap tidak
masuk**.

### 3. Investigasi mendalam — SEMUA lapisan diverifikasi sehat, tapi bug tetap muncul

Langkah verifikasi yang sudah dilakukan, SEMUA hasilnya sehat (lihat
detail command di transkrip sesi ini kalau perlu diulang):

1. **Worker production** — `fetch()` manual langsung ke
   `GET /sync?since=2026-10-19%2022:12:03` dengan token production asli
   (diambil dari `finance.db` production, BUKAN `.dev.vars` — sesuai
   [[feedback_worker_secret_not_in_dev_vars]]) → response 200,
   `thirdPartyFunds` berisi 37 baris lengkap dan benar. **Server-side
   100% sehat.**
2. **Data di D1 production** — account & contact yang direferensikan
   baris-baris itu ADA, tidak soft-deleted, `updated_at` format normal.
3. **Data di `finance.db` desktop production**
   (`C:\Users\Windows\AppData\Roaming\com.windows.financial-app\finance.db`
   — database BERBEDA dari `finance.dev.db` yang biasa dicek):
   - `third_party_funds`: 0 baris (sesuai laporan)
   - `accounts`/`contacts` terkait: SUDAH ADA lokal (tidak akan kena FK
     error saat insert)
   - `cloud_sync_last_checkpoint`: `2026-10-19 22:12:03` — LEBIH LAMA
     dari `updated_at` baris third_party_funds (`2026-10-21 12:3x-12:4x`),
     jadi filter `WHERE updated_at > ?1` Worker SEHARUSNYA tetap
     menyertakan baris itu. **Checkpoint ini tidak pernah berubah sejak
     19 Oktober** — indikasi kuat `runPull()` belum pernah selesai
     sukses sejak itu (checkpoint di-set di baris terakhir
     `run-pull.ts`, exception di tengah jalan mencegah itu).
   - `cloud_sync_enabled=1`, `workerUrl`+`token` production tersimpan
     benar — precondition `useAutoPullSync` terpenuhi.
   - `cloud_sync_queue`: 0 baris.
4. **Build timeline** — semua lebih baru dari commit fix, urutan benar:
   - commit `ac361f4`: 19:48:55
   - `apps/desktop/out/index.html` (Next.js static export): 19:50:00
   - `desktop.exe` release: 19:55:03
   - installer `.msi`/NSIS setup: 19:54-19:55
5. **Bundle JS hasil build** — grep langsung ke
   `out/_next/static/chunks/28za8pwq28law.js` ketemu baris
   `for(let a of e.thirdPartyFunds)await F(t,"third_party_funds",a,Y)}`
   — ini PERSIS loop fix dari `applySyncResponse`, ter-minify tapi jelas
   ada dan benar. **Kode fix 100% ter-bundle ke installer yang
   diinstal.**

**Kesimpulan investigasi**: Semua yang bisa diverifikasi secara statis
(kode, build, server, data) sehat. Tapi perilaku runtime aktual (`runPull`
tidak pernah selesai sukses) tidak cocok dengan semua bukti statis itu.
Sesi berakhir di titik ini TANPA root cause pasti.

### 4. Bug kedua ditemukan (independen, bukan penyebab masalah di atas) — belum di-commit

Saat membaca skema `cloud_sync_queue` untuk mencari kemungkinan exception
di `retryPendingPushes()`, ditemukan: CHECK constraint
`table_name IN (...)` tabel ini **tidak pernah diupdate** untuk
menyertakan `'third_party_funds'`, padahal `QueueableTable` (TypeScript)
sudah menyertakannya sejak Tahap 3 (sesi sebelumnya, Bug #2/#3 fix).

Pola yang seharusnya diikuti: migrasi copy-and-rename seperti
`0034_cloud_sync_queue_debts.sql`/`0043_..._investment.sql`/
`0046_..._labels.sql` setiap kali tabel baru ditambah ke
`QueueableTable` — langkah ini terlewat untuk `third_party_funds`.

**Dikonfirmasi BUKAN penyebab bug di atas**: `cloud_sync_queue` di
`finance.db` production kosong (0 baris) sepanjang investigasi, jadi
CHECK constraint ini belum pernah ter-trigger. Tapi tetap bug nyata yang
akan muncul begitu ada push `third_party_funds` yang gagal dan jatuh ke
retry queue (`enqueueUpsertPush`/`enqueueDeletePush` akan throw CHECK
violation).

**Fix dibuat, BELUM di-commit**:
- `apps/desktop/src-tauri/migrations/0055_cloud_sync_queue_third_party_funds.sql`
  (baru, pola persis 0046)
- `apps/desktop/src-tauri/src/migrations.rs` — entry `version: 55`
  ditambahkan (ingat [[feedback_migration_rs_registration]])

## Status kode saat ini

- Commit `ac361f4` (fix pull-sync gap) sudah di `main`, aman.
- **File migrasi 0055 + `migrations.rs` BELUM di-commit** — ada di
  working tree, perlu di-commit terpisah dari fix utama begitu root
  cause sesi ini ketemu (atau bisa di-commit kapan saja karena independen,
  tidak ada risiko — tapi tunggu dulu supaya tidak bikin bingung histori
  commit kalau ternyata tidak relevan).
- `tsc`/test belum dijalankan ulang setelah migrasi 0055 dibuat (hanya
  SQL + Rust, tidak ada perubahan TypeScript tambahan di langkah ini,
  kemungkinan besar tetap bersih tapi belum diverifikasi ulang).

## Gap yang TERSISA untuk sesi berikutnya — mulai dari sini

1. **Cari cara melihat error runtime di desktop build production.** Ini
   blocker utama — tidak ada devtools/log yang sudah dicek, dan
   `catch {}` kosong di
   [use-pull-sync/index.ts](../../../apps/desktop/src/shared/cloud-sync/use-pull-sync/index.ts)
   baris ~40-43 menelan error aslinya tanpa jejak. Opsi yang belum
   dicoba:
   - Build versi **debug** (bukan release) dan jalankan `desktop.exe`
     langsung dari terminal supaya stderr/stdout (termasuk uncaught
     promise rejection) terlihat.
   - Tambahkan logging sementara (`console.error` atau tulis ke file) di
     `catch` block tersebut, minta user build+jalankan+kirim isi log.
   - Cek apakah Tauri production build mengizinkan devtools WebView
     (`tauri.conf.json` — ada flag `devtools` di beberapa versi Tauri).
2. **Cek lebih kritis urutan checkpoint di `run-pull.ts`**: baris 21
   (`setCheckpoint` utama) dieksekusi SEBELUM `pullAttachments` (baris
   23). Kalau `pullAttachments` yang gagal, `cloud_sync_last_checkpoint`
   SEHARUSNYA sudah berubah duluan sementara `cloud_sync_attachments_checkpoint`
   stuck — tapi yang teramati KEDUA checkpoint stuck di tanggal yang
   sama (19 Oktober). Cek apakah ini kebetulan (keduanya terakhir
   di-set bersamaan di pull sukses 19 Oktober itu) atau instruktif
   tentang di mana exception sebenarnya terjadi.
3. **Baca ulang `useAutoPullSync` lebih kritis** — pertimbangkan race
   antara `enabled` yang berubah dari `false`→`true` saat query settings
   masih loading, dan efek `hasPulledRef` — apakah ada skenario pull
   tidak pernah benar-benar terpanggil sama sekali (bukan terpanggil
   lalu gagal).
4. **Cek apakah ada tombol "Sync sekarang" manual di UI settings** —
   belum dicek keberadaannya. Kalau ada, coba trigger manual untuk
   membedakan apakah masalah di auto-trigger (`useAutoPullSync`) atau di
   `runPull`/`applySyncResponse` itu sendiri.
5. Setelah root cause ketemu dan fix: **commit migrasi 0055** (lihat di
   atas) sekaligus kalau belum, dan verifikasi ulang `tsc --noEmit` +
   test suite cloud-sync.
6. Setelah semua terbukti bekerja, update
   [docs/todos/done/third-party-sync.md](../../todos/done/third-party-sync.md)
   dengan bug ketiga ini (lanjutan "Bug kelima" yang sudah ditulis di
   sana untuk `ac361f4`).

## Catatan proses (feedback untuk sesi berikutnya)

- **User menguji di PRODUCTION BUILD, bukan dev server** — ini beda
  signifikan dari pola dogfooding biasa proyek ini (yang selalu
  `tauri dev`+`wrangler dev`, lihat [[feedback_tauri_dev_restart_after_fix]]).
  Production build tidak punya console log yang mudah diakses seperti
  dev server — perlu strategi debugging berbeda (lihat gap #1 di atas).
  **Jangan asumsikan pola verifikasi dev yang biasa berlaku di sini.**
- **Semua kecurigaan "build belum update"/"checkpoint sudah kelewat"
  sudah dibuktikan SALAH satu per satu lewat pengecekan langsung**
  (timestamp file, isi bundle JS hasil grep, nilai checkpoint aktual di
  SQLite) — bukan diasumsikan dari gejala permukaan. Pola ini
  dipertahankan dengan baik di sesi ini: setiap hipotesis diverifikasi
  dengan command konkret sebelum lanjut atau dibuang. **Lanjutkan pola
  ini di sesi berikutnya** — jangan menebak root cause baru tanpa bukti
  langsung, mengingat beberapa hipotesis masuk akal sebelumnya (checkpoint,
  build staleness, CHECK constraint) semua terbukti BUKAN penyebabnya.
  Memeriksa SQLite production (`finance.db`) langsung lewat `sqlite3`
  CLI (dengan backup dulu ke scratchpad) terbukti sangat berguna untuk
  investigasi ini — pertahankan kebiasaan backup-dulu-baca sebelum
  menyentuh database production siapa pun.
- Ditemukan juga 1 bug independen (CHECK constraint `cloud_sync_queue`
  ketinggalan untuk `third_party_funds`) secara tidak sengaja saat
  investigasi — jangan lupa bug-bug kecil seperti ini bisa muncul saat
  menyusuri kode untuk mencari bug lain; dicatat & dibuat fix-nya
  langsung meski tidak jadi fokus utama, tapi SENGAJA belum di-commit
  supaya tidak campur dengan investigasi utama yang masih terbuka.
