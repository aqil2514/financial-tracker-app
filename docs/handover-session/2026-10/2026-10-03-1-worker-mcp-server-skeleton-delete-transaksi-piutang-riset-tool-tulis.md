# Handover — 2026-10-03 (sesi 1)

Lanjutan dari `2026-10-01-2-tahap-6-selesai-push-pull-backfill-cors-verifikasi-production.md`.
Sesi ini FOKUS: menutup gap #2 dan #3 dari handover sebelumnya (token
MCP terpisah, skeleton `apps/mcp-server`/Tahap 5), menuntaskan poin #1
(`DELETE /transactions/:id` di kedua sisi Worker+PC), menulis dokumen
konsep utang-piutang untuk audiens non-teknis, dan RISET (bukan
implementasi) daftar tool TULIS MCP untuk sesi berikutnya.

## Ringkasan hasil sesi

### 1. Worker — `MCP_SYNC_TOKEN` + `GET /auth/verify` (menutup gap #2)

- `Env.MCP_SYNC_TOKEN` baru, terpisah dari `PC_SYNC_TOKEN` —
  `isAuthorized()` terima kedua token. Digenerate via PowerShell
  `RandomNumberGenerator` .NET (user tidak py `openssl` di PowerShell).
- `GET /auth/verify` — endpoint ringan khusus validasi token (requireAuth
  lalu `{ok:true}`, TANPA sentuh D1) — dibutuhkan krn tidak ada endpoint
  existing yang cocok utk "cek token valid tanpa efek samping".
- **Scope sengaja dibatasi**: hardcode `sync_source='mcp'` yang tersebar
  di banyak `service.ts` TIDAK dibenahi sesi ini — nunggu tool TULIS MCP
  beneran ada yang butuh itu dinamis.
- User generate token production sendiri, `wrangler secret put`, deploy
  ulang — DIVERIFIKASI jalan di production (token benar → 200, salah/
  tanpa token → 401).

### 2. `apps/mcp-server` — skeleton Tahap 5, DEPLOYED & diverifikasi live (menutup gap #3)

- Next.js App Router + `mcp-handler`/`@modelcontextprotocol/server`
  (paket resmi dari Vercel, BUKAN `@modelcontextprotocol/sdk` yang
  dipakai referensi Retailku — nama & API beda).
- **OAuth shim** diadaptasi dari pola Retailku
  (`D:\Programming\Pribadi\retail-multitenant\apps\api\src\app\mcp\`),
  BUKAN port 1:1: form HTML minta token (bukan API key DB lookup —
  divalidasi via `GET /auth/verify` Worker), PKCE S256, access_token
  yang dibalikin = token Worker itu sendiri (pola passthrough sama).
  `protectedResourceHandler` PAKAI bawaan `mcp-handler` (bukan
  di-handcode manual spt Retailku).
- **Keputusan sadar**: state OAuth (code sementara) in-memory `Map`,
  BUKAN Cloudflare/Vercel KV — risiko gagal di serverless diterima krn
  flow ini cuma terjadi sekali per setup koneksi, bukan tiap request.
- **5 tool BACA** (`get_account_balances`, `get_expense_summary_by_category`,
  `list_transactions`, `get_debt_summary`, `get_contact_history`) — SEMUA
  manggil `GET /sync` (snapshot penuh, endpoint yang sudah ada) lalu
  filter/agregasi di `apps/mcp-server` sendiri, BUKAN nambah endpoint
  baca baru di Worker. Formula saldo akun DIDUPLIKASI dari
  `accounts/service.ts` (bukan panggil endpoint per-akun, N+1 mahal).
- **DIVERIFIKASI 2 lapis**: (1) full OAuth flow di production asli
  (register→authorize dgn token production→PKCE exchange→`tools/list`→
  `tools/call`), narik data produksi NYATA (98 piutang, Rp36.137.014);
  (2) **client MCP SUNGGUHAN** (Claude Web, bukan simulasi) — user
  berhasil connect & dapat ringkasan pemasukan/pengeluaran bulan
  berjalan dari data asli, hasil cocok ekspektasi.
- Env `.env` dibuatkan dgn placeholder (user isi nilai asli sendiri),
  `.gitignore` sudah benar (`.env*` kecuali `.env.example`).

### 3. `DELETE /transactions/:id` — SELESAI PENUH, Worker + PC (menutup poin #1)

Desain bergeser dari rencana awal "guard yang memblokir" (draft di "Yang
BELUM diputuskan") jadi **"tindakan otomatis aman + info ke user setelah
sukses"**, hasil diskusi ulang ttg hubungan transaksi↔akun↔tipe akun:

- **3 kemungkinan peran transaksi** (`getTransactionDebtStatus`, sudah
  ada sebelumnya utk jalur edit): `none` (hapus langsung), `payment`
  (hapus `debt_payments` + revert status `debts` ke `ongoing` kalau
  perlu), `principal` (SET NULL `transaction_id` — piutang/cicilan TETAP
  UTUH nominalnya, baik sudah/belum dicicil, krn `remaining` dihitung
  dari `amount - SUM(debt_payments)`, independen dari `transaction_id`).
- **TIDAK ADA payload pilihan dari client** (beda dari `DELETE /accounts/:id`
  yg py `transactionAction` opsional) — tindakan tunggal per role.
- **Worker**: `detachDebtForDeletedTransaction()` baru
  (`debts/service.ts`), `deleteTransaction()` baru
  (`transactions/service.ts`), response `{status, id, debtInfo}`.
  DIVERIFIKASI 4 skenario + 3 error case di Worker lokal (data dibuat
  lewat endpoint HTTP sungguhan, bukan INSERT manual).
- **PC**: port fungsi yang sama (`shared/debts/apply-debt-transaction.ts`),
  dipanggil LOKAL (independen dari cloud sync aktif/tidak) sebelum
  hard-delete — toast informatif berbasis status LOKAL, BUKAN response
  Worker (gap yang sempat kelewat saat desain: kalau numpang ke Worker,
  toast tidak pernah muncul buat user yang cloud sync-nya OFF).
  `pushDeleteTransactionOnWrite()` terpisah utk sinkron ke Worker
  (non-blocking thdp UX lokal).
- **Bug nyata ditemukan SAAT nulis unit test** (bukan dari baca kode):
  `getTransactionDebtStatus()` diam-diam buka KONEKSI DB KEDUA via
  `getDb()` sendiri, padahal dipanggil dari fungsi yang sudah terima
  `db` dari caller — 2 koneksi beda utk 1 operasi yang seharusnya pakai
  koneksi yang sama. Ketahuan dari `ReferenceError: window is not
  defined` (Tauri IPC dipanggil di lingkungan test Node). Diperbaiki:
  fungsi terima `db` sbg parameter eksplisit.
- **DIVERIFIKASI di `tauri dev` SUNGGUHAN** (sesuai aturan project,
  `checking-dev-database.md`) — user buat transfer cash→akun debt +
  cicilan parsial lewat UI asli, hapus KEDUANYA, toast muncul tepat
  sesuai role, diverifikasi via query `finance.dev.db` (copy+WAL):
  hapus cicilan → `debt_payments` bersih terhapus, piutang induk
  `ongoing` tidak berubah; hapus principal → `transaction_id` NULL,
  nominal/status tidak tersentuh. 171 test lolos (166 lama+5 baru), 0
  regresi.

### 4. Dokumentasi konsep baru (audiens non-teknis)

- **`docs/concept/konsep-utang-piutang.md`** (baru) — awalnya diminta
  sempit ("konsep hapus transaksi piutang"), DIPERLUAS atas permintaan
  user jadi konsep utang-piutang MENYELURUH: kenapa fitur ini ada,
  bagaimana piutang/utang lahir otomatis dari arah transfer, pelunasan
  multi-piutang FIFO, status lifecycle, kontak sbg identitas konsisten,
  ATURAN EDIT (sebelumnya belum ada versi non-teknisnya di mana pun) dan
  ATURAN HAPUS (hasil kerja poin 3 di atas) transaksi terkait. Bahasa
  sehari-hari murni, TANPA istilah pemrograman sama sekali (user
  eksplisit minta ini bisa dipahami orang non-IT).
- **`docs/diferensiasi.md`** diupdate menyeluruh — banyak bagian usang
  (ditulis 2026-09-27/30, sebelum Tahap 5&6 selesai): bagian 4 (cloud
  sync, paling signifikan berubah — dari "mulai dibangun" jadi
  "fungsional, client MCP sungguhan sudah dicoba"), bagian "Yang belum
  jadi diferensiasi" (multi-device sync), catatan kecil di bagian 1
  (link ke konsep baru).
- **`docs/todos/plan/cloud-sync-mcp.md`** (index lintas-app root) —
  update MENYELURUH, banyak tahap tercatat "BELUM DIMULAI" padahal sudah
  lama selesai. Ditambah bagian baru "Gap aktif" yang merangkum 3 sisa
  pekerjaan nyata (tool TULIS MCP, Tahap 7 verifikasi, 25 transaksi
  historis).

### 5. Riset (BUKAN implementasi) — daftar tool TULIS MCP untuk sesi berikutnya

User eksplisit minta sesi ini BERHENTI di riset, implementasi+testing di
sesi terpisah. Hasil riset (inventaris lengkap via eksplorasi kode
langsung, bukan tebakan) ditulis di `apps/worker/docs/todos/plan/cloud-sync.md`
bagian Tahap 5 "Tool TULIS". Ringkasan temuan kunci:

- **Endpoint Worker utk 5 tabel (transactions/accounts/account_groups/
  categories/contacts) SUDAH LENGKAP** (create/update/delete) — tool
  tulis MCP tinggal memanggil, TIDAK perlu endpoint Worker baru.
- **TIDAK ADA endpoint `/debts` atau `/debt-payments`** — dan ini
  SENGAJA, bukan celah. Desktop sendiri pun tidak py endpoint terpisah
  (`use-create-debt.ts`/`use-pay-debt.ts` cuma kemudahan UI, di baliknya
  selalu lewat transaksi transfer + `applyDebtTransaction`). Jadi tool
  "catat piutang"/"bayar piutang" WAJIB diimplementasi sbg pemanggilan
  `POST /transactions` dgn `type:transfer` + `debtAction`+`settleDebtIds`
  — BUKAN tool/endpoint terpisah.
- **Gap ditemukan**: `resolveContactId()` (get-or-create kontak by nama)
  sudah di-port penuh ke Worker, TAPI belum disambungkan ke endpoint
  `/transactions` manapun (yang ada cuma terima `contactId` final).
  Relevan krn tool MCP akan terima nama kontak dalam bahasa natural dari
  Claude, bukan ID siap pakai — 2 opsi dicatat di dokumen, belum
  diputuskan yang mana.
- Attachment (`transaction_attachments`) sengaja TIDAK masuk scope tool
  tulis — di luar jangkauan D1 (file fisik lokal PC).
- 4 keputusan lain sengaja DIBIARKAN terbuka utk sesi implementasi:
  daftar final tool & granularitas, resolusi kontak (opsi di atas),
  `sync_source` dinamis per token, validasi tambahan khusus MCP (mis.
  perlu konfirmasi berlapis utk delete krn tidak ada UI dialog di sisi
  Claude).

## Status kode saat ini

- **`apps/worker` LIVE di production**, redeploy sesi ini (MCP_SYNC_TOKEN
  + `/auth/verify` + `DELETE /transactions/:id`).
- **`apps/mcp-server` LIVE di Vercel**
  (`https://financial-tracker-mcp-server.vercel.app`) — SKELETON BARU,
  sisi baca selesai, sisi tulis belum disentuh sama sekali.
- **`apps/desktop`**: hook delete transaksi + logic debt lokal diubah,
  171 test lolos, DIVERIFIKASI di `tauri dev` dgn data nyata.
- Semua perubahan kode (worker + desktop + mcp-server) sudah di-COMMIT &
  di-PUSH oleh user sendiri (bukan saya) — sesuai pola sesi-sesi
  sebelumnya.
- 3 dokumen diupdate/dibuat: `docs/concept/konsep-utang-piutang.md`
  (baru), `docs/diferensiasi.md`, `docs/todos/plan/cloud-sync-mcp.md`.

## Gap yang TERSISA untuk sesi berikutnya

1. **Implementasi + testing tool TULIS MCP** — tujuan utama sesi
   berikutnya. Riset lengkap sudah ada di
   `apps/worker/docs/todos/plan/cloud-sync.md` bagian Tahap 5, termasuk
   4 keputusan yang perlu diambil DI AWAL sesi implementasi (lihat
   bagian 5 di atas) sebelum mulai nulis kode.
2. Tahap 7 (verifikasi konflik nyata + soft-delete cross-device) — masih
   terblokir, menunggu poin 1.
3. `sync_source` dinamis per token di endpoint2 spt `correct-balance`
   (saat ini hardcode `'mcp'`) — jadi prasyarat begitu tool tulis MCP
   mulai dipakai sungguhan, supaya baris yg ditulis lewat MCP vs PC bisa
   dibedakan benar.
4. 25 transaksi historis yang ditolak Worker — sengaja dibiarkan
   terbuka, bukan prioritas.

## Catatan proses (feedback utk sesi berikutnya)

- **User eksplisit minta pemisahan riset vs implementasi** jadi dua sesi
  berbeda ("pahami dulu saja, belum ke implementasi... implementasi
  sekaligus testing di sesi baru") — pola BARU, beda dari sesi-sesi
  sebelumnya yang biasanya riset+implementasi+verifikasi jadi satu alur.
  Kemungkinan krn scope tool TULIS ini cukup besar (banyak keputusan
  desain) shg layak dipisah supaya implementasi bisa fokus tanpa
  gangguan riset di tengah jalan.
- **User minta dokumentasi "konsep" terpisah dari dokumentasi teknis** —
  folder baru `docs/concept/` khusus audiens non-teknis, EKSPLISIT minta
  "bisa dipahami orang yang tidak paham IT". Beda total dari dokumen
  `docs/todos/plan/*.md` yang memang ditulis utk developer (termasuk
  saya sendiri di sesi depan). Pola BARU utk dicatat: kalau user minta
  tulis ke `docs/concept/`, HINDARI istilah pemrograman sama sekali
  (bukan cuma "disederhanakan", tapi benar2 dihindari: tidak ada
  "transaction_id", "role", "SET NULL", "database", dst — semua diganti
  bahasa manusia biasa).
- **User minta scope dokumen concept diperluas dari permintaan awal** —
  awalnya saya tulis sempit ("konsep hapus transaksi piutang"), user
  minta diperluas jadi "konsep utang piutang di aplikasi ini" secara
  menyeluruh. Pola: kalau diminta tulis dokumentasi konsep untuk topik
  yang baru selesai dikerjakan, pertimbangkan apakah topiknya lebih
  pas didokumentasikan sbg konsep MENYELURUH drpd cuma fitur spesifik
  yang baru dikerjakan — tanya dulu kalau ragu, jangan asumsikan scope
  sempit itu yang dimaksud.
- **Verifikasi production/nyata KONSISTEN jadi keharusan**, pola yang
  sama persis dgn sesi-sesi sebelumnya — kali ini ditegaskan lagi lewat
  aturan tertulis project sendiri (`checking-dev-database.md`) yang
  secara eksplisit melarang berhenti di `tsc`/test utk perubahan yang
  MENULIS data. Unit test dgn fake DB tetap berharga (menangkap 1 bug
  nyata soal koneksi DB ganda), TAPI tidak dianggap cukup menggantikan
  verifikasi `tauri dev` sungguhan utk fitur tulis data.
- **Proses debugging lingkungan verifikasi berulang kali jadi
  blocker kecil** sesi ini: (1) Tauri IPC (`window.__TAURI__`) tidak ada
  di browser biasa — sempat salah coba verifikasi section Settings lewat
  Playwright+Edge sebelum sadar harus `tauri dev`; (2) proses `next dev`
  lama yang belum benar2 mati bikin `tauri dev` gagal start pertama kali
  (`EADDRINUSE`-like, port 3200 "Another next dev server is already
  running"). Pola utk diingat: SELALU cek proses node/next yang
  tertinggal dari sesi verifikasi sebelumnya SEBELUM mulai `tauri dev`
  baru, jangan asumsikan proses sebelumnya sudah bersih.
- **User tidak mau nilai token/secret terlihat di chat** — saat butuh
  token production utk tes manual, user arahkan ke file
  `.dev.vars.production` (dibuat user sendiri, sudah di-gitignore) alih-
  alih mengetik nilainya; saya baca file itu lalu pakai via variabel
  shell tanpa pernah menampilkan nilainya di output/pesan. Pola yang
  harus tetap dijaga ke depannya.
