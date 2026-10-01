# Handover — 2026-10-01 (sesi 1)

Lanjutan dari `2026-09-30-3-worker-scaffold-dan-port-logic-bisnis.md`.
Sesi ini FOKUS: tuntaskan sisa pekerjaan `apps/worker` Tahap 4 (3 logic
bisnis sisa, CRUD lengkap 4 entity + delete dgn reassign/unassign,
UPSERT+LWW beneran, endpoint pull), lalu mulai Tahap 6 — fondasi klien
PC (`apps/desktop`) memanggil Worker. TIDAK menyentuh `apps/mcp-server`
(masih belum ada sama sekali).

## Ringkasan hasil sesi

### Worker (`apps/worker`) — Tahap 4 sekarang SELESAI (kecuali 2 item kecil)

**7 dari 7 logic bisnis kritis dari audit SELESAI** (sebelumnya 4/7).
3 logic sisa di-port lewat endpoint baru `PATCH /transactions/:id`:

- **#2 guard edit** (`DebtEditBlockedError`) — `getTransactionDebtStatus()`
  (versi Worker, query D1 langsung) resolve role transaksi
  (`none`/`principal`/`payment`) SEBELUM update jalan; `principal` yg
  field berbahayanya berubah DAN sudah dicicil → 422 blocked SEBELUM
  baris `transactions` tersentuh sama sekali.
- **#3 validasi pelunasan ≤ sisa** — **CELAH DITUTUP**. Fungsi baru
  `validateDebtSettlementAmount()` dipanggil sbg PRE-CHECK SEBELUM
  insert/update `transactions` apa pun (bukan di dalam
  `settleDebtsFifo` spt dugaan audit awal) — **temuan atomicity BARU**:
  kalau reject terjadi SETELAH tulis baris transaksi, baris itu
  tersimpan tanpa FIFO settlement-nya (tidak atomic, D1 `batch()` tidak
  cocok krn FIFO butuh baca-remaining-dulu-baru-tulis). Solusinya:
  SEMUA pre-check (#2, #3, #4) dipindah ke sebelum tulis apa pun —
  pola yg SAMA dgn #4 yg sudah lebih dulu begitu.
- **#7 `dangerousFieldsChanged`** — port PERSIS dari
  `use-update-transaction.ts`, bandingkan field type/account/transfer/
  amount/contact vs nilai LAMA transaksi.

**CRUD lengkap utk `accounts`, `account_groups`, `categories`,
`contacts`** — sebelumnya cuma `transactions` yg py create+update:

- Create+update ke-4 entity: port PERSIS hook desktop masing2
  (`use-create-*`/`use-update-*`), TANPA validasi baru di luar yg sudah
  ada di desktop (mis. `category.parent.type !== type` TETAP tidak
  divalidasi, sama kayak desktop).
- **Riset penting**: `debts`/`debt_payments` TERNYATA TIDAK PUNYA
  padanan create/update LANGSUNG di desktop — "tambah utang/piutang"
  dan "bayar" SELALU lewat `transactions` (transfer) +
  `applyDebtTransaction`, sudah ter-cover endpoint `/transactions`.
  **SENGAJA SKIP** endpoint `/debts`+`/debt-payments` langsung supaya
  tidak menduplikasi logic FIFO di jalur baru.
- `resolveContactId()` (get-or-create exact-match, WAJIB direplikasi
  per audit) sudah di-port ke `contacts/service.ts`, diekspor utk
  dipakai modul lain nanti — BELUM ada entry point HTTP yg memanggilnya
  (konsekuensi dari skip `/debts` manual).
- **Endpoint DELETE** (4 entity, soft delete via `deleted_at`) —
  keputusan desain dikonfirmasi user: field aksi EKSPLISIT per relasi
  (`*Action: "unassign"|"reassign"` + target id), PERSIS pola desktop,
  BUKAN default diam-diam. `accounts` py DUA kolom yg wajib ditangani
  bareng (`account_id` + `transfer_account_id`), `categories` py DUA
  relasi independen (sub-kategori + transaksi), `contacts` TANPA
  payload sama sekali (desktop tidak py reassign/unassign di sini).
  **Temuan arsitektur baru**: soft-delete `contacts` TIDAK auto-NULL
  `transactions.contact_id` (beda dari hard-delete+FK desktop) — dicek
  eksplisit via JOIN, dicatat sbg keputusan terbuka (BELUM urgent,
  `contact_id` cuma dipakai laporan ringkasan).
- **Gap ditemukan**: `accounts` ternyata belum py create/update sama
  sekali (cuma `balance`/`correct-balance` sebelumnya) — DITUTUP sesi
  ini juga.

### UPSERT + LWW beneran — SEMUA endpoint tulis

Sebelumnya SEMUA endpoint cuma INSERT/UPDATE polos (`updated_at` selalu
ditulis baru TANPA dibandingkan dgn baris existing) — push dari PC bisa
menimpa perubahan dari HP tanpa conflict resolution apa pun, padahal
itu SELURUH alasan proyek cloud-sync ini ada.

- Helper generik baru `shared/lww.ts` (`decideLww`/
  `resolveIncomingUpdatedAt`/`nowText`/`isValidUpdatedAt`), dipakai
  SEMUA modul tulis.
- **Keputusan desain dikonfirmasi user** (urutan penting): (1) scope
  dipersempit ke "LWW check di endpoint existing" dulu, pull BELUM
  (ternyata dikerjakan jg di sesi ini, lihat bawah); (2) `POST` jadi
  UPSERT jg (bukan cuma `PATCH`) — id bentrok TIDAK error, treat spt
  update; (3) format `updatedAt` payload = TEXT "YYYY-MM-DD HH:mm:ss"
  sama persis dgn kolom, opsional (kosong = server pakai `now()`,
  SELALU menang); (4) **BREAKING CHANGE**: `id` WAJIB dari caller utk
  `account_groups`/`categories`/`contacts`/`accounts` (dulu
  server-generate `uuidv7()`) — supaya UPSERT bisa tau row mana tanpa
  pull dulu; (5) LWW menang CLEAR `deleted_at` jg (row ter-soft-delete
  "hidup lagi" kalau sisi lain edit dgn timestamp lebih baru); (6)
  `POST`+`PATCH` TETAP dua2nya ada, semantik sama (upsert).
- `transactions` PALING kompleks — LWW dicek PALING AWAL, SEBELUM
  validasi bisnis #2/#3/#4 dst (payload stale tidak perlu divalidasi).
  `insertTransaction` (POST) direfactor: id sudah ada → delegasi ke
  `updateTransactionRow` (fungsi internal yg SAMA dipakai jalur PATCH).
- **Bug nyata ditemukan & diperbaiki SAAT verifikasi** (bukan dari
  desain): skenario pertama "UPSERT menang" sempat balikin `id` BARU
  (uuidv7) bukan update row existing — root cause-nya deploy
  SEBELUMNYA belum sinkron (Version ID berubah lagi stlh redeploy
  eksplisit), BUKAN bug logic. Retest setelah redeploy, semua lolos.
- DIVERIFIKASI end-to-end: create, stale-ignored, menang-update,
  un-delete via LWW win, PATCH jg diuji, **regresi 0** logic #1 (FIFO)
  & #4 (larangan akun debt) di jalur UPSERT baru.

### Endpoint pull `GET /sync?since=` — BARU, modul `src/modules/sync/`

- Satu endpoint gabungan (BUKAN per-tabel) — balas SEMUA 7 tabel
  sekaligus, field camelCase konsisten dgn payload endpoint tulis.
- `since` kosong = first sync = **full snapshot SEMUA baris** (termasuk
  soft-deleted) — user sempat tanya soal biaya D1 runtime, dijelaskan
  biaya dihitung dari ROWS READ bukan ukuran response & ini cuma
  terjadi SEKALI, diputuskan lanjut (jangan over-engineer dari awal).
- `checkpoint` di response = waktu Worker MEMPROSES request (diambil
  SEBELUM query jalan) — hindari celah baris berubah pas query jalan.
- Filter `updated_at > since` STRICT greater-than (bukan `>=`).
- DIVERIFIKASI: full snapshot, incremental, boundary strict `>`, 400
  format invalid, 401 no-auth, semua 7 key + `checkpoint` ada.

### Kontrak response "ignored" diperbaiki (ditemukan SAAT bangun klien PC)

Sebelumnya status LWW-ignored dibalas via `{status:"ok", message:
"Ignored: existing row is newer (LWW)"}` — pesan bebas di `message`,
BUKAN field terstruktur. Rapuh utk caller OTOMATIS (PC/MCP) yg perlu
deteksi reliable (bukan cuma ditampilkan ke user). Ditemukan user saat
saya tulis unit test utk `worker-client.ts` (desktop) yg awalnya
deteksi via `message.startsWith("Ignored:")`. **Diperbaiki SEMUA
controller endpoint tulis** (8 titik, 5 file) jadi `{status:"ignored",
id}` eksplisit. Worker di-redeploy & diverifikasi ulang, 0 regresi.

### Tahap 6 — fondasi klien PC (`apps/desktop`) DIMULAI (bukan selesai)

Baru bagian FONDASI (keputusan eksplisit user: "logic Worker dulu, UI
nanti") — BELUM ada UI Settings, hook push on-write, atau logic pull
yg benar2 jalan dari app:

- `shared/cloud-sync/use-cloud-sync-settings.ts` — 4 key baru di tabel
  `settings` (`cloud_sync_enabled`/`cloud_sync_worker_url`/
  `cloud_sync_token`/`cloud_sync_last_checkpoint`), pola PERSIS
  `use-retailku-settings.ts` (`useQuery`+`useDbMutation`).
- **Perubahan pendukung**: `hooks/use-db-mutation.ts` ditambah opsi
  `silent?: boolean` (skip toast, tetap invalidate+onSuccess) — perlu
  krn update checkpoint terjadi OTOMATIS tiap pull sukses (background,
  bukan 1x aksi user), tanpa ini toast muncul berulang.
- `shared/cloud-sync/worker-client.ts` — wrapper HTTP MURNI ke semua
  endpoint Worker (5 fungsi push, 1 pull, 1 test-connection). Terima
  `{workerUrl, token}` eksplisit, TIDAK baca sendiri dari settings —
  tetap testable tanpa React Query/SQLite.
- **Diuji 2 lapis**: smoke test manual Node thdp Worker PRODUCTION
  nyata (bukan mock, semua skenario cocok), DAN unit test formal
  `worker-client.test.ts` (13 test, `fetch` di-mock via
  `vi.stubGlobal`) — user eksplisit minta ("tulis saja juga
  unitestnya"). Full test suite desktop (166 test, 23 file) 0 regresi.

## Status kode saat ini

- **`apps/worker` LIVE di production**, SEMUA perubahan sesi ini sudah
  di-deploy (`wrangler deploy` berkali-kali, Version ID terakhir
  `f82bf44f`). D1 KOSONG dari data uji (prosedur konsisten: seed →
  verifikasi via curl+`wrangler d1 execute` → hapus, diverifikasi 0
  baris tersisa di tiap checkpoint).
- **SEMUA perubahan BELUM di-commit** — baik `apps/worker` maupun
  `apps/desktop` (termasuk 2 file test baru). User eksplisit minta
  TIDAK di-commit oleh saya ("biar saya saja yang commit nanti").
- `apps/mcp-server` MASIH BELUM ADA sama sekali.

## Gap yang TERSISA untuk sesi berikutnya

Urutan realistis (detail lengkap di
`apps/worker/docs/todos/plan/cloud-sync.md` dan
`apps/desktop/docs/todos/plan/mcp-server-cloud-mirror.md`):

1. **Lanjutkan Tahap 6** (prioritas, baru fondasi): UI Settings
   (`content/cloud-sync/` di `features/settings/`, toggle+form+tombol
   tes koneksi), logic pull (terapkan `SyncResponse` ke SQLite lokal
   dgn LWW compare, update checkpoint), hook push ON-WRITE (titik
   INSERT/UPDATE/DELETE transaksi/akun/dst, async non-blocking), queue
   retry utk push gagal/offline.
2. **Sisa kecil Tahap 4**: `DELETE /transactions/:id` (perlu keputusan
   desain guard debt/payment dulu — desktop sendiri TIDAK py guard ini
   sama sekali); token MCP terpisah dari `PC_SYNC_TOKEN` (prasyarat
   sblm `sync_source` endpoint `correct-balance` bisa berhenti
   hardcode `'mcp'`, ada `TODO` eksplisit di kode).
3. **Tahap 5**: `apps/mcp-server` (Vercel) — belum disentuh SAMA
   SEKALI, app-nya sendiri belum ada.
4. **Tahap 7**: verifikasi end-to-end lintas-app (skenario HP↔PC,
   konflik, soft-delete) — butuh Tahap 5+6 jalan dulu.

## Catatan proses (feedback utk sesi berikutnya)

- **User MINTA scope dipersempit secara eksplisit 2x di sesi ini**:
  (a) UPSERT+LWW awalnya mau full (termasuk endpoint pull), user minta
  fokus "LWW check di endpoint existing" dulu, pull belakangan — TAPI
  akhirnya pull DIKERJAKAN JUGA di sesi yg sama (krn momentum masih
  jalan & scope-nya jadi jelas setelah LWW push selesai); (b) soal Tahap
  6, user eksplisit "masalah UI nanti saja deh, setidaknya kita ke
  logic workernya dulu" — pola yg SAMA dgn sesi2 sebelumnya (user OK
  diajak kerja cepat tapi suka mempersempit scope dulu sebelum
  eksekusi, bukan menolak kerjanya).
- **Setiap keputusan desain dgn trade-off TETAP ditanya via
  AskUserQuestion** sepanjang sesi (reassign vs unassign, bentuk
  payload delete, urutan cek LWW vs validasi bisnis, format `since`
  kosong, dll) — user KONSISTEN pilih opsi "Recommended" yg saya
  usulkan (bukan selalu, tapi dominan) — kemungkinan pola: usulan
  "Recommended" saya sejauh ini align dgn preferensi user (konservatif,
  konsisten dgn pola existing, hindari over-engineering) — TETAP
  tawarkan pilihan eksplisit, jangan mulai berasumsi "Recommended pasti
  dipilih" dan skip tanya.
- **Dua bug nyata ditemukan SAAT verifikasi, BUKAN dari desain
  awal**: (1) atomicity #3 (reject setelah tulis → baris yatim) —
  ditemukan user SAAT saya jelaskan rencana implementasi, SEBELUM
  coding (baik!); (2) deploy belum sinkron saat tes UPSERT pertama kali
  (id baru bukan update) — ditemukan SAAT verifikasi production nyata,
  BUKAN dari baca kode. Pola yg SAMA dgn sesi2 sebelumnya: verifikasi
  end-to-end production itu BUKAN formalitas, selalu temukan sesuatu
  yg tidak kelihatan dari baca kode/typecheck saja — JANGAN downgrade
  ke "yakin dari statis analysis aja cukup" di sesi lanjutan.
- **User minta unit test ditulis scr eksplisit** ("tulis saja juga
  unitestnya") SETELAH saya cuma jalankan smoke test manual thdp
  production — artinya smoke test production TIDAK dianggap pengganti
  unit test formal bagi user, keduanya dianggap perlu (smoke test utk
  verifikasi kontrak nyata, unit test utk regresi jangka panjang +
  dokumentasi kontrak). Pola BARU dicatat: utk modul client/wrapper
  (bukan logic bisnis Worker yg sudah py pola verifikasi production),
  tulis unit test jg sbg bagian standar, jangan nunggu diminta lagi.
- **Token production `PC_SYNC_TOKEN` TIDAK ada di `.dev.vars` lokal**
  (beda nilai, `.dev.vars` cuma utk `wrangler dev` lokal) — user harus
  paste token manual tiap sesi yg butuh curl ke endpoint production.
  Sudah dicatat sbg memori lintas-sesi
  (`feedback_worker_secret_not_in_dev_vars.md`).
