# Handover — 2026-09-29 (sesi 3)

Lanjutan dari `2026-09-29-2-representasi-kas-pelunasan-dan-dp-ar-ap.md`.
Sesi ini SANGAT beragam — 4 topik tidak berurutan: (1) menuntaskan
DRY_RUN sync AR/AP Retailku, (2) audit+pemindahan dokumen `plan/` ke
`done/`, (3) fitur baru + restrukturisasi besar `features/debts/`, (4)
riset panjang (BUKAN implementasi) soal Turso + MCP server untuk masa
depan aplikasi ini.

## Ringkasan hasil sesi

### 1. DRY_RUN sync AR/AP Retailku — DINONAKTIFKAN, tervalidasi live

`sync-cashflow.ts`: `DRY_RUN = false` (sebelumnya selalu `true` di semua
sesi sebelumnya). Diverifikasi dengan HATI-HATI mengikuti
`docs/rules/checking-dev-database.md`:

- **Database dev SEBELUMNYA tercampur fitur lama** ("Piutang Retailku"
  snapshot manual, migrasi 0018) — user minta salin ulang `finance.db`
  (PRODUKSI) → `finance.dev.db` supaya titik mulai bersih. Dilakukan
  (copy `.db`+`.db-wal`+`.db-shm` sekaligus, `tauri dev` dipastikan
  tertutup dulu).
- User menjalankan sync sungguhan (bukan simulasi) di database bersih
  itu. Hasil diverifikasi via query SQL langsung: 2 baris `debts` baru
  (`source: retailku_sync`, kontak "Mba-mba Kado Kuning") DAN 2 baris
  `transactions` DP (`source_ref: ...:ar_ap_dp`) ter-INSERT BENAR,
  nilai cocok pola yang sudah diriset sebelumnya (DP > piutang net).
- **Kasus skip "settled-debt-not-found" JUGA terkonfirmasi live**: baris
  "Nenek Petok" (-Rp2000) — dicek ke MCP Retailku
  (`get_sales_customer_transactions`), piutang aslinya tercipta
  2026-05-29 (`SL-260529-11`), JAUH sebelum rentang sync yang pernah
  dijalankan (mulai September) — BUKAN bug, cabang skip bekerja benar
  krn piutang induk belum pernah masuk `debts` lokal.
- **Cabang "ketemu" pelunasan (`debt_payments` terisi) MASIH belum
  tervalidasi live** — perlu sync mundur ke rentang yg mencakup
  piutang lama dulu. Akan terjadi bertahap secara alami, BUKAN gap
  kode yang perlu dikerjakan lagi.
- Verifikasi: `tsc`/`vitest` (153/153)/`cargo check` bersih di setiap
  langkah.

### 2. Audit dokumen `plan/` → 3 dipindah ke `done/`

User minta cek semua dokumen `plan/` mana yang sudah layak `done/`.
Agent Explore (background) membaca 6 dokumen tersisa (selain yang di
poin 1) — HASIL: 3 dari 6 layak pindah, 3 sisanya memang masih ada
kerja terbuka nyata (bukan basa-basi):

**Dipindah ke `done/`:**
1. `retailku-ar-ap-negative-amount-settlement.md` — checklist terakhir
   (DRY_RUN) sekarang `[x]`, `account_type: advance` diklarifikasi
   BUKAN scope dokumen ini (cuma referensi silang).
2. `retailku-ar-ap-via-cashflow-detail.md` — sudah lama "DITUTUP —
   DIGANTIKAN" tapi implementasi intinya sendiri SELESAI+terverifikasi
   sejak lama, cuma belum dipindah. Ditambah catatan penutup merujuk ke
   rangkaian dokumen penerus yang sekarang juga sudah tuntas.
3. `retailku-sync-field-mapping.md` — skema `retailku_sync_field_mapping`
   (migrasi 0020/0023/0024) SUDAH diimplementasikan & dipakai produksi
   (dikonfirmasi: kode query `retailku_account_mapping` lama SUDAH
   tidak dipakai lagi, cuma disebut di komentar historis). "Mode
   ketiga" (PPOB/Consignment) sengaja di luar scope, dilacak terpisah.

**TETAP di `plan/`** (kerja terbuka nyata, bukan dipindah):
`database-integrity-audit.md` (temuan #2/#3 terbuka), `retailku-dynamic-sourcetype-mapping.md`
(baru rancangan), `retailku-investment-sync.md` (BLOCKED oleh
`account-type.md`), `retailku-sale-category-mapping.md` (riset teknis
tuntas, tapi pemanfaatan di financial-app belum ada rencana), plus
`account-type.md`/`budget-feature.md`/`debt-receivable-tracking.md`/
`import-category-dedup.md`/`mcp-server-for-claude.md`/`multi-device-sync.md`
(semua eksplisit "belum diputuskan"/belum dikerjakan — TIDAK dicek
detail sesi ini kecuali 2 yang riset di poin 4 bawah).

### 3. Fitur baru + restrukturisasi `features/debts/`

Dipicu dari user melihat UI Ringkasan Kontak (screenshot) dan merasa
struktur file `features/debts/` melenceng dari `docs/rules/page-layout.md`.

**Filter & Sort di halaman Ringkasan Kontak** (`/debts`):
- Filter: Nama Kontak (text), Jenis (Piutang/Utang, OR/union kalau
  keduanya dicentang), Status Pelunasan (Belum Dibayar/Lunas Semua).
- Sort: Nama Kontak, Sisa Piutang, Sisa Utang, Piutang Pokok, Utang
  Pokok.
- `use-contact-summary.ts` diperluas terima `FilterConfig[]`+`SortConfig[]`
  — kolom computed (`has_receivable`/`has_payable`/`remaining_status`)
  perlu subquery-wrap (pola sama `BALANCE_EXPRESSION` di
  `use-accounts-paginated.ts`) krn SQLite tidak izinkan filter alias di
  level SELECT yang sama. Field "Jenis" butuh OR lintas 2 kolom beda —
  DIEKSTRAK MANUAL sbg `ExtraCondition` sebelum sisanya lewat
  `buildWhereClause` generik (tidak bisa lewat `allowedColumns` biasa).
- Posisi toolbar: awalnya rata kanan, user minta rata KIRI.

**Dialog detail per kontak** (tombol ikon "Info" baru di tiap card):
- Riwayat LENGKAP (semua status, termasuk lunas — beda dari card
  ringkasan yg cuma hitung `ongoing`) + daftar `debts` individual +
  cicilan (`debt_payments`) per baris EXPANDABLE (lazy-fetch, cuma
  query saat baris pertama kali dibuka).
- Query baru: `use-contact-debts.ts`, `use-debt-payments.ts`. Helper
  baru `status-labels.ts` (naik ke `shared/debts/`, sebelumnya
  terduplikasi di `debt-list-table.tsx`).
- Dialog pakai `EntityFormDialog` (reuse, generik meski namanya
  "Form") dgn `max-w-3xl`, BUKAN `Sheet` (ada di `components/ui/` tapi
  belum pernah dipakai fitur manapun, lebar defaultnya sempit).

**Restrukturisasi besar** (`page-layout.md` compliance):
- `features/debts/` (utk `/debts/receivables`+`/payables`) dipangkas
  jadi CUMA `debt-list-table.tsx` + barrel.
- `features/debts-summary/` (fitur BARU, khusus `/debts`) dibuat dgn
  struktur wajib `header/`+`content/`+`page/` — `content/card/` sbg
  sub-section widget kompleks (dipindah utuh dari `debts/card/`).
- `new-debt-form/`+`pay-debt-form/` NAIK ke `shared/debts/` (dipakai
  KEDUA fitur, hindari cross-import antar fitur — keputusan eksplisit
  user "naikkan ke shared/debts" saat ditanya).
- Verifikasi tiap tahap: `tsc`/`vitest` (153/153 tetap) bersih, query
  SQL dicoba langsung ke `check.db` (salinan dev) utk pastikan sintaks
  benar sebelum user coba live. **User konfirmasi "berhasil" di
  `tauri dev` di akhir.**

### 4. Riset (BUKAN implementasi) — Turso + MCP server

User bertanya panjang lebar soal arsitektur masa depan (distribusi
aplikasi, multi-device, MCP untuk Claude Web) — TIDAK ADA KODE ditulis,
murni diskusi+riset, semua dicatat di
`docs/todos/plan/mcp-server-for-claude.md` (diperluas dari 102 jadi
304 baris) DAN `docs/todos/plan/multi-device-sync.md` (ditambah bagian
baru soal AUTOINCREMENT). **BACA KEDUA DOKUMEN ITU langsung untuk
detail lengkap** — ringkasan poin kunci:

- Turso (libSQL, embedded replica) COCOK krn filosofinya SAMA dgn
  offline-first yang sudah dipakai app ini — beda total dari
  Supabase/Postgres (klien-server klasik).
- `user_id` TIDAK WAJIB — independen dari soal Turso/multi-device.
  Pola lebih natural: 1 Turso database PER USER, bukan 1 database besar
  + kolom `user_id`.
- Masalah NYATA utk multi-device (terpisah dari `user_id`): primary key
  `INTEGER AUTOINCREMENT` di SEMUA tabel sekarang akan TABRAKAN kalau
  2+ device menulis offline bersamaan (walau user yang sama) — solusi
  standar: UUID. Dicatat sbg rekomendasi eksplisit di
  `multi-device-sync.md`: migrasi UUID lebih murah dilakukan SEKARANG
  sebelum tabel makin banyak (mis. sebelum `account_type` ditambah),
  bukan ditunda sampai mau distribusi.
- Batasan Turso free tier diverifikasi ULANG dari screenshot dashboard
  nyata user (100 database, TAPI kuota storage/read/write/sync DIGABUNG
  utk seluruh akun, bukan per-database).
- MCP server BUKAN jembatan pasif — kumpulan TOOLS dgn logic query
  nyata (setara layer `shared/*/use-*.ts`), scope tumbuh bertahap.
- Keputusan hosting: Vercel Hobby (BUKAN gabung VPS Retailku) —
  diperkuat, bukan diubah, krn scope MCP yang ternyata besar.
- **Temuan penting**: repo `portofolio` (proyek lain milik user,
  `D:\Programming\Pribadi\portofolio\web\src\app\api\mcp\route.ts`)
  SUDAH PUNYA implementasi MCP server kerja nyata via package
  `mcp-handler` (dari `vercel/mcp-handler`, BUKAN
  `@modelcontextprotocol/server` yang awalnya dieksplorasi) — pola
  `createMcpHandler`+`server.registerTool`+`export async function
  GET/POST` bisa DICONTOH LANGSUNG utk `financial-app`. Rate limiting
  (`@upstash/ratelimit`) juga sudah ada polanya di situ.
- Yang BELUM diputuskan/diriset (PR lanjutan): skema autentikasi
  (portofolio TIDAK PUNYA krn datanya publik, financial-app WAJIB
  tambah), cara koneksi `@libsql/client` dari Vercel ke Turso, daftar
  tool MCP pertama, detail provisioning otomatis via Turso Platform
  API.

## Status kode saat ini (PENTING, baca sebelum lanjut apa pun)

- Sync AR/AP Retailku: DRY_RUN OFF, kode sungguhan aktif. Cabang
  "pelunasan ketemu" (`debt_payments`) tetap perlu sync rentang mundur
  utk tervalidasi live pertama kali — BUKAN gap kode.
- `features/debts/` sudah direstrukturisasi TOTAL — kalau ada dokumen
  lama/memori yang menyebut path lama (`features/debts/card/`,
  `features/debts/new-debt-form/`, `features/debts/page/`, dst), path
  itu SUDAH TIDAK ADA, sudah pindah ke `features/debts-summary/` atau
  `shared/debts/`.
- `docs/todos/plan/mcp-server-for-claude.md` DAN `multi-device-sync.md`
  — status TETAP "riset/ide", BUKAN "siap implementasi". Jangan
  asumsikan sesi berikutnya boleh langsung coding Turso/MCP tanpa
  menjawab dulu daftar "belum diputuskan" di kedua dokumen itu.

## Verifikasi hasil kerja sesi ini

1. `npx tsc --noEmit` — bersih di setiap iterasi (DRY_RUN, filter/sort,
   dialog detail, restrukturisasi).
2. `npx vitest run` — 153/153 lulus SEPANJANG sesi (tidak ada test baru
   ditulis sesi ini — semua perubahan UI/query baru belum ada unit test,
   cuma diverifikasi manual+live).
3. `cargo check` — tidak dijalankan ulang sesi ini (tidak ada perubahan
   Rust/migrasi baru setelah poin 1).
4. Query SQL baru (filter/sort/detail dialog) dicoba LANGSUNG ke
   salinan `check.db` (scratchpad) sebelum user coba live — semua
   sintaks terverifikasi benar.
5. **User mengkonfirmasi VISUAL langsung di `tauri dev`**: filter+sort
   Ringkasan Kontak ("Oke berhasil"), restrukturisasi tidak
   menyebabkan regresi.

## Gap yang TERSISA untuk sesi berikutnya

1. Cabang "pelunasan ketemu" sync AR/AP — belum tervalidasi live,
   tinggal tunggu/sync rentang yang tepat (lihat poin 1 di atas).
2. Dialog detail kontak & filter/sort BELUM ada unit test — cuma
   diverifikasi manual query SQL + visual `tauri dev`.
3. Turso + MCP server — MURNI riset, 0% implementasi. Sebelum mulai
   coding, jawab dulu 4 poin "belum diputuskan" di
   `mcp-server-for-claude.md` (skema auth, cara koneksi libSQL, tool
   pertama, provisioning otomatis).
4. Migrasi UUID (rekomendasi baru di `multi-device-sync.md`) — BELUM
   diputuskan user apakah mau dikerjakan sekarang atau ditunda, cuma
   argumen "lebih murah sekarang" yang dicatat.
5. Perubahan yang belum di-commit sepanjang sesi ini (DRY_RUN, 3 file
   pindah plan→done, filter/sort, dialog detail, restrukturisasi
   debts, update 2 dokumen plan) — user belum eksplisit minta commit di
   akhir sesi ini.

## Catatan proses (feedback untuk sesi berikutnya)

- **User TIDAK ingin agen menyalin database produksi ke dev tanpa
  konfirmasi eksplisit dua kali** — sempat ditanya soal tauri dev
  status dan soal backup dulu via AskUserQuestion sebelum benar-benar
  menimpa `finance.dev.db`. Pola ini konsisten dgn "actions dgn blast
  radius besar wajib dikonfirmasi dulu", bukan diasumsikan dari
  approval sebelumnya.
- **User memutuskan detail desain lewat pertanyaan terarah, bukan
  dibiarkan agen putuskan sendiri** — konsisten sesi-sesi sebelumnya:
  saat filter "Jenis" butuh keputusan OR vs AND, saat pemilihan folder
  restrukturisasi (`features/debts-summary/` vs subfolder di dalam
  `debts/`), semua ditanya eksplisit lewat AskUserQuestion sebelum
  eksekusi kode.
- **Riset arsitektur masa depan (Turso/MCP) dilakukan sbg DISKUSI
  MURNI, user eksplisit TIDAK minta kode ditulis** — pola percakapan
  panjang tanya-jawab teknis dgn banyak koreksi bertahap (mis. "server
  cuma jembatan?" dikoreksi setelah pertanyaan lanjutan soal MCP
  tools yang dinamis). **Pelajaran: jangan buru-buru simpulkan
  arsitektur simpel di awal ("cuma jembatan tipis") sebelum eksplorasi
  detail lebih jauh** — kesimpulan awal beberapa kali perlu dikoreksi
  seiring pertanyaan user makin spesifik.
- **Repo sibling (`portofolio`) ternyata punya implementasi relevan
  yang jadi referensi lebih baik dari dokumentasi resmi** — saat
  diminta cek repo portofolio utk MCP, ditemukan pola kerja nyata
  (`mcp-handler`, bukan SDK resmi yang awalnya dieksplorasi via
  `npm view`+ekstrak tarball). **Pelajaran: kalau user py proyek lain
  yang mungkin relevan, tanya/cek lebih awal SEBELUM riset mendalam ke
  dokumentasi generik** — akan lebih efisien dibanding verifikasi
  manual lewat `npm pack`+`tar` dulu baru ternyata ada contoh nyata
  yang lebih baik.
- **Selalu verifikasi versi SDK/tool via `npm view` (bukan cuma
  WebFetch dokumentasi)** — WebFetch ke npm diblokir (403), tapi `npm
  view <pkg>` via Bash tetap jalan dan lebih otoritatif (nomor versi
  persis, tanggal rilis, maintainer). Dipakai utk konfirmasi
  `@modelcontextprotocol/server`, `@modelcontextprotocol/node`, DAN
  `mcp-handler` semuanya nyata sebelum menjawab user.
