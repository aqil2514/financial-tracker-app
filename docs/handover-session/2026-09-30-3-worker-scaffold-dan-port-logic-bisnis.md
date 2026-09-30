# Handover — 2026-09-30 (sesi 3)

Lanjutan dari `2026-09-30-2-desain-mcp-server-sync-dua-arah.md` (sesi
desain, TANPA kode). Sesi ini FOKUS: eksekusi kode pertama dari rencana
itu — scaffold `apps/worker` dari nol, deploy ke production, port 4
dari 7 logic bisnis kritis dari audit, migrasi ke Hono, plus
reorganisasi besar dokumentasi jadi struktur per-app + index lintas-app
di root. TIDAK menyentuh `apps/mcp-server` (belum dibuat).

## Ringkasan hasil sesi

### `apps/worker` — dibuat dari nol, LIVE di production

Cloudflare Worker baru, workspace npm (`apps/worker`), terhubung ke D1
asli (`financial-app`, region APAC, sudah di-provisioning sesi
sebelumnya via user manual `wrangler d1 create`). **Di-deploy ke
production** (bukan cuma preview `wrangler dev`):
`https://financial-app-worker.muhamadaqil383.workers.dev`.

Struktur final (setelah 2x refactor besar dalam sesi ini):

```
apps/worker/
├── schema/0001_initial.sql       ← skema D1, 7 tabel + kolom sync
├── src/
│   ├── index.ts                  ← induk Hono, .route() tiap modul
│   ├── shared/
│   │   ├── env.ts                ← interface Env (DB, PC_SYNC_TOKEN)
│   │   └── auth.ts               ← requireAuth (middleware Hono)
│   └── modules/
│       ├── health/controller.ts
│       ├── transactions/{router,controller,service,schema}.ts
│       ├── accounts/{router,controller,service,schema}.ts
│       └── debts/service.ts      ← TANPA router/controller/schema,
│                                     dipanggil dari transactions
│                                     (pola "pemilik vs pemicu")
├── docs/rules/module-structure.md ← aturan lengkap, BACA sebelum ubah struktur
└── docs/todos/plan/cloud-sync.md  ← dokumen utama fitur ini
```

### 2 keputusan arsitektur BESAR yang berubah DALAM sesi ini (bukan dari sesi lalu)

1. **Struktur kode**: mulai dari SATU file `index.ts` (~100 baris,
   semua endpoint+logic ditumpuk) → dipecah jadi
   `controller`/`service`/`schema` per modul, setelah user secara
   eksplisit khawatir soal skala file ke depan (7 tabel × banyak
   operasi × validasi bisnis). Keputusan "modul PEMILIK vs modul
   PEMICU" utk logic lintas-tabel (mis. FIFO debt dipicu dari
   `transactions` tapi dimiliki `debts`) — **BACA
   `apps/worker/docs/rules/module-structure.md` sebelum nambah modul
   baru**, jangan reka pola sendiri.
2. **Routing**: mulai dari manual `if (url.pathname === ...)` di
   `index.ts` (keputusan sadar, alasan: modul masih sedikit) → **DIBATALKAN
   dan diganti Hono** begitu path dinamis pertama dibutuhkan
   (`/transactions/:id` utk endpoint update, BELUM dibuat — baru
   alasan kenapa migrasi ini dilakukan SEKARANG, bukan pas endpoint
   update-nya sendiri dibuat). Pola: tiap modul py `router.ts` (sub-app
   Hono), `index.ts` jadi induk `.route(prefix, subApp)`. Auth JUGA
   dipindah dari cek manual berulang di tiap controller jadi middleware
   `requireAuth` dipasang sekali per router (`router.use(requireAuth)`).
   **DIVERIFIKASI regresi penuh di production setelah migrasi — 0
   regresi**, semua endpoint+logic bisnis existing dites ulang.

### 4 dari 7 logic bisnis kritis (dari audit sesi 2) SUDAH di-port

Semua **DIVERIFIKASI end-to-end di production** dgn data uji nyata
(insert manual via `wrangler d1 execute`, panggil endpoint via `curl`,
cek hasil, HAPUS data uji lagi — bukan cuma percaya kode).

- **#5 Formula saldo akun** (`accounts/service.ts`,
  `getAccountBalance()`) — port PERSIS dari `use-accounts.ts`
  (`SELECT_ACCOUNTS_WITH_BALANCE`), termasuk arah tanda transfer.
  BEDA sengaja dari query asli: filter `deleted_at IS NULL` ditambah
  SEJAK AWAL (soft delete belum dipakai di kode manapun skrg, tapi
  aman krn semua baris NULL — begitu Tahap 6 mulai soft-delete,
  formula ini otomatis benar tanpa perlu diingat lagi).
- **#6 Koreksi saldo manual** (`accounts/service.ts`,
  `correctAccountBalance()`) — get-or-create kategori "Penyesuaian
  Saldo" per type, no-op kalau diff=0. BEDA dari desktop: `currentBalance`
  DIHITUNG ULANG sendiri di Worker (panggil `getAccountBalance()`),
  TIDAK dipercaya dari client (desktop terima dari cache React Query,
  Worker tidak bisa percaya itu).
- **#1 FIFO debt** (`debts/service.ts`, `applyDebtTransaction()` +
  `settleDebtsFifo()` private) — port PERSIS dari
  `apply-debt-transaction.ts`: cash→debt = piutang baru otomatis;
  debt→cash = WAJIB `debtAction` eksplisit (`'payable'`/`'settlement'`);
  debt→debt/cash→cash = no-op. Dipanggil dari
  `transactions/service.ts` SETELAH insert `transactions` berhasil.
- **#4 Larangan income/expense di akun `debt`**
  (`transactions/service.ts`, `violatesDebtAccountRule()`) — DI SINI
  jadi VALIDASI KERAS (HTTP 422 reject), BEDA dari desktop yg
  auto-correct via `useEffect` form — Worker tidak punya UI utk
  "otomatis ganti pilihan user", cuma bisa terima/tolak.

**3 logic BELUM di-port** (#2 guard edit, #3 validasi pelunasan ≤ sisa,
#7 `dangerousFieldsChanged`) — SEMUA terkait endpoint UPDATE transaksi
yg BELUM ADA (baru endpoint create). **#3 PENTING**: `settleDebtsFifo`
yg SUDAH di-port TIDAK menolak kelebihan alokasi pelunasan — diam-diam
tidak mengalokasikan sisanya (silent, PERSIS peringatan di audit sesi
2). Client (PC/MCP tool) WAJIB validasi ini SENDIRI sampai #3 di-port.

### Bug desain ditemukan & diperbaiki SEBELUM sempat jadi masalah nyata

`correctAccountBalance()` awalnya `return null` utk DUA kasus beda
(akun tidak ada vs tidak ada perubahan) — controller memperlakukan
keduanya sbg "200 OK", padahal akun tidak ditemukan seharusnya 404.
Diperbaiki jadi return type eksplisit (`account_not_found`/`no_change`/
`corrected`) sebelum sempat dipakai sungguhan.

### `sync_source` untuk endpoint non-push — keputusan sementara, ADA TODO

Endpoint yg BUKAN hasil push dari PC (`/accounts/correct-balance`)
di-hardcode `sync_source='mcp'`. Ini SEMENTARA — begitu token MCP
terpisah dari `PC_SYNC_TOKEN` dibuat (belum ada), WAJIB diganti jadi
derive dari JENIS TOKEN yg dipakai request, BUKAN dari body payload
client (bisa dipalsukan). Ada komentar `TODO(sync_source)` eksplisit
di kode (`accounts/service.ts`).

### Keterbatasan tooling ditemukan (penting utk sesi depan)

`wrangler dev --remote` TIDAK meneruskan `.dev.vars` ke Worker yg jalan
di edge remote (env var jadi `undefined`, WALAU ringkasan binding
terminal menampilkan "(hidden)" seolah ter-load — MENYESATKAN).
`wrangler dev` TANPA `--remote` membaca `.dev.vars` dgn benar TAPI D1
jadi simulasi lokal kosong (bukan data asli). **Verifikasi penuh
(auth+D1 asli sekaligus) HARUS lewat `wrangler deploy` sungguhan**,
tidak ada mode `wrangler dev` yg bisa keduanya sekaligus. Ditemukan via
endpoint debug sementara (`/debug-auth`, sudah dihapus lagi dari kode).

### `package uuidv7` — TERBUKTI kompatibel Cloudflare Worker

Dipakai (bukan `crypto.randomUUID()`) supaya format ID SAMA dgn PC
(`apps/desktop/src/lib/id.ts`, keputusan `uuid-migration.md`). Belum
pernah divalidasi jalan di Worker runtime sebelum sesi ini — sekarang
terbukti, dipakai di `accounts/service.ts` & `debts/service.ts`.

### Reorganisasi dokumentasi BESAR (2 gelombang)

**Gelombang 1**: `mcp-server-cloud-mirror.md` (awalnya SEMUA campur di
`apps/desktop`) dipecah jadi 3:
- `apps/worker/docs/todos/plan/cloud-sync.md` — dokumen UTAMA (semua
  keputusan desain, progress implementasi Worker).
- `apps/desktop/docs/todos/plan/mcp-server-cloud-mirror.md` — dipangkas
  jadi cuma bagian PC (migrasi lokal, integrasi UI Settings).
- `apps/desktop/docs/todos/plan/mcp-server-business-logic-audit.md` —
  TETAP di tempat (isinya audit kode desktop), rujukannya diperbaiki.
- `docs/todos/plan/cloud-sync-mcp.md` (root, awalnya bernama
  `README.md` — di-rename krn kesannya "satu-satunya rencana") — index
  navigasi ringkas, checklist per tahap + link ke dokumen detail.
- `docs/todos/README.md` (BARU) — jelaskan konvensi umum
  `plan/`/`done/` (aktif vs arsip) DAN pola root-vs-per-app (root utk
  lintas-app, per-app utk scope satu app) — dibuat krn user tegaskan
  folder ini utk fitur lintas-app APA PUN ke depan, bukan cuma topik
  MCP ini.

**Gelombang 2** (di penghujung sesi ini, TERPISAH dari yg di atas):
folder `docs/handover-session/` (16 file, SEMUA riwayat sesi sejak
2026-09-22) dipindah dari `apps/desktop/docs/handover-session/` ke
ROOT — user tegaskan SEMUA handover pindah (bukan cuma yg lintas-app),
demi konsistensi lokasi tunggal. Dipindah via `git mv` (histori git
tetap utuh, terdeteksi sbg rename bukan delete+add). **CATAT INI**:
mulai sesi berikutnya, tulis handover baru ke `docs/handover-session/`
di ROOT, BUKAN lagi di `apps/desktop/docs/handover-session/` (folder
lama itu sudah TIDAK ADA).

### File memori baru (lintas-sesi, bukan project-specific)

`feedback_migration_rs_registration.md` — pelajaran dari insiden nyata
sesi ini: menulis file migrasi `.sql` baru di `apps/desktop` TIDAK
CUKUP, wajib didaftarkan manual di `src-tauri/src/migrations.rs`
(`include_str!` per file). Migrasi `0028_cloud_sync_columns.sql`
sempat "tidak jalan" berkali-kali restart `tauri dev` krn lupa
langkah ini — user yg menyadari & menanyakan duluan.

## Status kode saat ini

- **`apps/worker` LIVE di production**, D1 berisi skema 7 tabel
  (KOSONG dari data nyata — semua data uji sesi ini SELALU dihapus
  lagi setelah verifikasi, prosedur konsisten dipakai sepanjang sesi).
- **`apps/desktop`**: 1 migrasi baru (`0028_cloud_sync_columns.sql`,
  `updated_at`/`deleted_at`/`sync_source` di 7 tabel), DIVERIFIKASI
  jalan di `finance.dev.db` nyata (bukan cuma db uji) — lihat
  `docs/rules/checking-dev-database.md` (masih di `apps/desktop`,
  TIDAK ikut dipindah — isinya spesifik prosedur cek db PC).
- **SEMUA perubahan sudah di-commit** oleh user sendiri sepanjang sesi
  (9 commit: `97da05c` s/d `a74bd6a`) — TIDAK ada working tree kotor
  tersisa dari eksekusi kode. Reorganisasi handover-session (gelombang
  2) BELUM di-commit di titik penulisan handover ini.
- `apps/mcp-server` MASIH BELUM ADA sama sekali — folder
  `docs/todos/plan/` sudah disiapkan kosong sesi sebelumnya, isinya
  masih kosong.

## Gap yang TERSISA untuk sesi berikutnya

Urutan realistis kalau mau lanjut (lihat detail lengkap +checklist di
`apps/worker/docs/todos/plan/cloud-sync.md` Tahap 4):

1. **Endpoint UPDATE transaksi** (`PATCH /transactions/:id`, path
   dinamis pertama yg makanya Hono dipasang) — BELUM ADA sama sekali.
   Prasyarat utk port 3 logic sisa (#2, #3, #7).
2. **3 logic bisnis sisa**: #2 guard edit (`DebtEditBlockedError`),
   #3 validasi pelunasan ≤ sisa (CELAH AKTIF, lihat di atas), #7
   `dangerousFieldsChanged` — butuh fungsi resolve
   `TransactionDebtStatus` versi Worker (query D1, bukan dari cache
   spt desktop).
3. **Endpoint tulis utk 5 tabel lain** (`account_groups`, `categories`,
   `contacts`, `debts` langsung, `debt_payments`) — baru `transactions`
   & `accounts` yg py endpoint.
4. **UPSERT+LWW beneran** — SEMUA endpoint tulis skrg masih INSERT
   polos, belum bandingkan `updated_at` existing vs baru.
5. **Autentikasi PC↔Worker vs MCP** — token SEKARANG (`PC_SYNC_TOKEN`)
   dipakai utk SEMUA caller (termasuk endpoint yg secara semantik
   "bukan dari PC" spt correct-balance, lihat TODO `sync_source` di
   atas). Token MCP terpisah BELUM dibuat.
6. **`apps/mcp-server` (Vercel)** — belum disentuh SAMA SEKALI, app-nya
   sendiri belum ada.
7. **Tahap 6 (integrasi klien PC)** — TIDAK ADA satu baris kode pun di
   `apps/desktop` yg memanggil Worker. Section Settings, hook push
   on-write, dst — semua masih rencana.

## Catatan proses (feedback utk sesi berikutnya)

- **User menyela 2x soal keputusan arsitektur BESAR di tengah
  eksekusi** (struktur modul, lalu routing/Hono) — POLA SAMA dgn sesi
  2 (menyela soal scope). Pelajaran: utk proyek baru/kode dari nol,
  JANGAN asumsikan struktur file "yang penting jalan dulu" — user
  peka thd skala/kerapian kode SEJAK AWAL, lebih baik tawarkan opsi
  struktur eksplisit (spt yg akhirnya dilakukan via AskUserQuestion)
  drpd nulis 1 file besar dulu baru dirapikan belakangan.
- **User secara eksplisit minta jeda utk paham dulu** ("saya terlalu
  terburu buru... hal yang baru bagi saya") saat scope mulai terasa
  besar (port 7 logic bisnis) — direspons dgn rangkuman progress
  lengkap (bukan lanjut eksekusi) sebelum lanjut. Pola user: OK diajak
  kerja cepat/banyak keputusan berturut-turut, TAPI perlu clarifying
  question ATAU rangkuman jeda kalau kompleksitas mulai menumpuk tanpa
  jeda — jangan tafsirkan diam sbg "paham semua".
- **Setiap klaim "logic X sudah di-port" WAJIB diverifikasi end-to-end
  di production dgn data nyata** (insert manual → panggil endpoint →
  cek hasil di D1 → hapus data uji) — dipakai KONSISTEN sepanjang
  sesi, TIDAK ada satu pun logic yg "dianggap benar" cuma dari
  typecheck lolos. Pola ini worth diulang; JANGAN downgrade ke "yakin
  scr statis aja cukup" di sesi lanjutan.
- **Setiap keputusan desain kecil yg py trade-off (bukan cuma soal
  selera) ditanyakan via AskUserQuestion, bukan diasumsikan** — mis.
  nama kolom `sync_source` vs `source` (bentrok kolom bisnis existing),
  return type `null` ambigu, hardcode `sync_source='mcp'` vs terima
  dari client. User SELALU merespons dgn pilihan yg lebih konservatif/
  aman (bukan yg paling cepat) — pola ini konsisten dgn preferensi yg
  sudah dicatat sesi-sesi sebelumnya ("jangan usulkan opsi lebih
  rumit sbg default, tapi tetap tanya trade-off-nya").
