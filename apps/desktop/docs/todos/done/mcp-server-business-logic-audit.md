# Audit Logic Bisnis yang Perlu Direplikasi ke Server (MCP CRUD) — SELESAI

## Status & TODO saat ini (ringkas)

Audit + SEMUA item porting-nya SELESAI & diverifikasi (lihat
"Checklist porting" di bawah utk detail per item, termasuk 2 bug nyata
yang ditemukan sambil jalan: drift `settleDebtsFifo` & auto-null
`category_id` transfer).

- [x] Audit logic bisnis `apps/desktop` yang harus direplikasi ke
      Worker (7 risiko tinggi, beberapa risiko sedang/rendah).
- [x] Port `applyDebtTransaction`/`settleDebtsFifo`,
      `applyDebtTransactionEdit`, validasi nominal pelunasan, larangan
      income/expense di akun debt, formula saldo akun, koreksi saldo
      manual, `dangerousFieldsChanged` — semua ke Worker, diverifikasi
      end-to-end production.
- [x] Putuskan & implementasi kebijakan reassign/unassign saat delete
      account/category/account-group.
- [x] Port dedup kontak (`resolveContactId`) ke Worker.
- [x] Filter `category.type === transaction.type` dipaksakan di
      Worker (2026-10-05) — sekaligus temukan & fix bug auto-null
      `category_id` transfer yang hilang di jalur CREATE.
- [x] Definisi tunggal formula `remaining` (shared util/VIEW) —
      SELESAI 2026-10-05 (sisi desktop; Worker masih punya definisi
      sendiri, lihat catatan di bawah). **Bug DRIFT NYATA ditemukan &
      diperbaiki**: `settleDebtsFifo` lupa filter
      `debt_payments.deleted_at IS NULL`.
- [x] Guard delete transaksi terhadap debt/payment terkait — SUDAH
      SELESAI sejak 2026-10-03 (ketinggalan dicoret di sini, lihat
      detail di `mcp-server-cloud-mirror.md` poin 1 & catatan di
      bawah) — `detachDebtForDeletedTransaction` ada di desktop DAN
      Worker.
- [x] Format tanggal tool MCP divalidasi — SELESAI 2026-10-05, TAPI
      ternyata kekhawatiran asli audit ("harus SAMA PERSIS dgn `now()`
      desktop") salah premis, lihat catatan koreksi di bawah.

> Dipecah dari `mcp-server-cloud-mirror.md` Tahap 2 (2026-09-30) supaya
> dokumen utama tidak terlalu panjang. Dokumen ini KHUSUS berisi hasil
> audit + checklist porting logic bisnis, dan TETAP di `apps/desktop`
> (bukan pindah ke `apps/worker`) krn isinya murni audit kode desktop
> (file:baris spesifik di `src/features/*` dst) — meski dipakai sbg
> checklist porting ke Worker. Semua keputusan sync/conflict
> resolution/arsitektur MCP ada di
> [`apps/worker/docs/todos/done/cloud-sync.md`](../../../../worker/docs/todos/done/cloud-sync.md)
> (dipecah lagi dari `mcp-server-cloud-mirror.md` supaya tiap app py
> dokumen sendiri, lihat [`docs/todos/plan/cloud-sync-mcp.md`](../../../../../docs/todos/plan/cloud-sync-mcp.md)
> di root utk index lintas-app). `mcp-server-cloud-mirror.md` sekarang
> cuma berisi bagian tanggung jawab PC (migrasi lokal, integrasi UI).

## Latar belakang

Audit dilakukan via Agent Explore (2026-09-30) atas `src/features/*`,
`src/shared/debts`, `src/shared/contacts`, dan `src-tauri/` app desktop,
untuk menjawab: logic bisnis apa saja yang HANYA berjalan di layer
TypeScript/React (bukan di constraint skema SQL), yang akan TERLEWATI
kalau tool MCP nanti insert/update langsung ke Cloudflare D1 tanpa lewat
kode TypeScript app desktop sama sekali.

**Temuan umum**: skema SQL (`src-tauri/migrations/*.sql`) HAMPIR TIDAK
PUNYA business rule finansial — satu-satunya constraint bisnis nyata
cuma `CHECK` enum (`type`, `status`, `account_type`, `source`) dan
`UNIQUE` idempotency sync (`source`+`source_ref`). Tidak ada CHECK saldo
tidak boleh minus, tidak ada trigger SQL sama sekali. Artinya SEMUA
logic di bawah akan benar-benar TERLEWATI kalau MCP tool insert langsung
ke D1 tanpa mereplikasinya.

## Wajib direplikasi di server/Worker SEBELUM tool tulis MCP diaktifkan (risiko TINGGI)

Risiko tinggi = data finansial bisa jadi salah/hilang senyap kalau
logic ini dilewati.

1. **`applyDebtTransaction` / `settleDebtsFifo`**
   (`src/shared/debts/apply-debt-transaction.ts:54-256`) — setelah
   insert/update transaksi `type=transfer`, deteksi arah akun
   (cash↔debt) dan: cash→debt = insert `debts` baru (`receivable`);
   debt→cash = butuh `debtAction` eksplisit (`'payable'` = utang baru,
   `'settlement'` = alokasi FIFO: urutkan `debts` by `date ASC, id ASC`,
   alokasikan `amount` sampai habis, insert `debt_payments` per debt
   kebagian, set `status='paid'` kalau lunas). Kalau dilewati: transfer
   kas↔utang TIDAK PERNAH tercatat sebagai piutang/utang sama sekali
   (silent bug, sudah didokumentasikan sebagai risiko nyata di komentar
   `use-transaction-form.ts:57-65`).
2. **`applyDebtTransactionEdit` + `DebtEditBlockedError`**
   (`apply-debt-transaction.ts:158-205`,
   `use-transaction-debt-status.ts:25-60`) — transaksi yang jadi
   `principal` sebuah piutang DAN field berbahaya berubah
   (amount/type/account_id/transfer_account_id/contact) DAN piutang itu
   sudah dicicil transaksi lain → WAJIB diblokir total (recreate akan
   menghapus cicilan via CASCADE). Kalau dilewati: piutang yang sudah
   dicicil bisa "berubah pokok"-nya diam-diam, cicilan jadi yatim.
3. **Validasi nominal pelunasan ≤ total sisa piutang terpilih**
   (`use-transaction-debt-fields.ts:59-87`, `pay-debt-form.tsx:36-44`)
   — HANYA divalidasi di UI, TIDAK diverifikasi ulang di
   `settleDebtsFifo` (fungsi itu diam-diam `break` begitu alokasi habis).
   Kalau dilewati: kelebihan bayar HILANG TANPA JEJAK (bukan error).
4. **Larangan transaksi income/expense di akun `account_type='debt'`**
   (`use-transaction-form.ts:56-82`) — SAAT INI cuma dipaksa via
   `useEffect` di form (auto-switch ke transfer / auto-clear akun),
   TIDAK ADA constraint DB apa pun yang mencegah `transactions.type=
   'income'` dengan `account_id` mengarah ke akun `debt`. Kalau
   dilewati: entry "salah alam" — tidak error, tapi piutang/utang tidak
   pernah tercatat (komentar kode aslinya eksplisit menyebut ini
   mencegah "bug senyap").
5. **Formula saldo akun** — TIDAK ADA kolom `balance` tersimpan
   (`use-accounts.ts:15-42`, `calculate-balance.ts`): `balance =
   initial_balance + Σincome - Σexpense - Σ(transfer keluar dari
   account_id) + Σ(transfer masuk ke transfer_account_id)`. Harus
   direplikasi PERSIS (termasuk arah tanda transfer) kalau cloud mau
   menyajikan saldo konsisten dgn desktop. **Catatan penting**: TIDAK
   ADA larangan saldo negatif di mana pun (disengaja, bukan bug) —
   JANGAN tambahkan constraint `balance >= 0` di D1, akan jadi
   inkonsistensi perilaku dgn app desktop.
6. **Logic koreksi saldo manual**
   (`use-correct-account-balance.ts:31-71`) — `diff = targetBalance -
   currentBalance` (currentBalance = hasil formula #5, BUKAN
   `initial_balance` mentah); kalau `diff===0` no-op; kategori
   "Penyesuaian Saldo" di-get-or-create OTOMATIS per type
   (income/expense terpisah); insert transaksi dgn `note` hardcoded
   "Koreksi saldo". Kalau dilewati/direplikasi longgar: kategori
   duplikat/tidak konsisten dgn histori desktop.
7. **`dangerousFieldsChanged` comparison** sebelum update transaksi
   (`use-update-transaction.ts:67-78`) + guard "debtStatus belum
   termuat ditolak eksplisit" (`use-update-transaction.ts:100-106`) —
   dibandingkan terhadap NILAI LAMA transaksi (butuh state sebelumnya,
   tidak bisa dihitung tanpa itu). Field berbahaya: `type`,
   `account_id`, `transfer_account_id`, `amount`, `contact_id`
   (resolved). Field lain (note, description, attachment) tidak pernah
   trigger recreate debt.

## Perlu keputusan desain eksplisit (risiko SEDANG)

Risiko sedang = berdampak ke integritas laporan, bukan langsung
kehilangan uang.

- **Reassign/unassign relasi saat DELETE account/category/account-group**
  — desktop SELALU menawarkan pilihan eksplisit ke user sebelum delete:
  - Account (`use-delete-account.ts:19-49`): transaksi terkait
    (`account_id`/`transfer_account_id`) di-unassign (SET NULL) atau
    di-reassign ke akun lain, BARU delete. Skema sudah `ON DELETE SET
    NULL` jadi delete langsung tidak akan error — tapi berarti kalau
    MCP tool cuma `DELETE FROM accounts`, semua transaksi terkait
    otomatis ter-unassign TANPA pernah menawarkan opsi reassign, dan
    field NULL itu akan merusak formula saldo #5 (uang "menghilang"
    dari laporan tanpa notifikasi).
  - Category (`use-delete-category.ts:17-54`): DUA relasi ditangani
    (sub-kategori via `parent_id`, DAN transaksi via `category_id`),
    masing-masing unassign/reassign independen.
  - Account group (`use-delete-account-group.ts:15-35`): pola sama,
    tapi risiko lebih rendah (`group_id` tidak dipakai formula saldo
    manapun, murni kosmetik pengelompokan).
  - **DIPUTUSKAN & DI-IMPLEMENTASI 2026-10-01**: endpoint `DELETE` di
    Worker WAJIB menerima parameter aksi eksplisit per relasi (field
    `*Action: "unassign"|"reassign"` + target id), PERSIS pola desktop
    — BUKAN default "unassign" diam-diam. Lihat
    `apps/worker/docs/todos/done/cloud-sync.md` bagian endpoint
    `DELETE` utk detail lengkap + temuan soft-delete `contacts`.
- **Filter `category.type === transaction.type` TIDAK dipaksakan di DB**
  (`use-account-category-options.tsx:37-81`) — hanya filter dropdown
  UI. Kalau MCP tool insert transaksi `income` dengan `category_id`
  yang sebenarnya `type='expense'`, lolos total ke D1, merusak laporan
  per-kategori.
- **Auto-null `category_id` pada transaksi transfer**
  (`use-create-transaction.ts:88-90`) — transfer TIDAK PERNAH punya
  kategori, dipaksa NULL di TS meski form mengirim nilai lain.
- **Risiko DRIFT formula `remaining` (piutang/utang) dan `balance`** —
  ekspresi `amount - SUM(debt_payments)` ditulis ULANG di banyak file
  berbeda tanpa satu sumber kebenaran (`use-ongoing-debts.ts`,
  `use-debts-list.ts`, query FIFO di `apply-debt-transaction.ts`,
  `use-contact-summary.ts:111-181`). Kalau cloud membuat ulang formula
  ini dengan sedikit beda (mis. lupa filter `status='ongoing'`), angka
  ringkasan cloud vs desktop akan berbeda. Pertimbangkan definisikan
  SEKALI sebagai shared util/VIEW sebelum di-port ke Worker.
- **Delete transaksi TIDAK ADA guard sama sekali** terhadap debt/payment
  terkait (`use-delete-transaction.ts:7-17`) — beda dari edit (#2), FK
  cuma SET NULL. Piutang yang sudah dicicil bisa kehilangan jejak
  transaksi pokoknya tanpa peringatan apa pun di jalur delete manapun
  (baik dari PC maupun rencana tool MCP). **DITUTUP 2026-10-03** (lihat
  `mcp-server-cloud-mirror.md` poin 1) — `detachDebtForDeletedTransaction`
  sekarang ada di desktop (`apply-debt-transaction.ts`, dipanggil dari
  `use-delete-transaction.ts` + toast informatif berbasis status lokal)
  DAN Worker (`debts/service.ts`, dipanggil dari `deleteTransaction`):
  role `payment` → hapus `debt_payments` + kembalikan status `ongoing`
  kalau masih ada sisa; role `principal` → `transaction_id` SET NULL,
  piutang/utangnya TETAP ADA (tidak hilang, cuma kehilangan jejak
  transaksi asal) — diverifikasi end-to-end di `tauri dev` sungguhan.
  Juga: delete transaksi TIDAK menghapus file attachment fisik di disk
  (row `transaction_attachments` CASCADE, file-nya orphan) — relevan
  dicatat karena file lokal di luar jangkauan D1 sama sekali. **Poin
  attachment orphan ini BELUM ditutup** (beda dari guard debt/payment
  di atas yang sudah).

## Boleh diabaikan / ditangani longgar (risiko RENDAH)

- Dedup kontak fuzzy (Levenshtein ≤2 di `find-similar-contacts.ts`,
  hanya warning UI non-blocking) — bisa diserahkan ke tool caller
  (Claude) utk exact-match saja; auto-create by exact name via
  `resolve-contact.ts:11-25` tetap perlu direplikasi (bukan opsional)
  supaya nama bebas dari HP tidak selalu bikin kontak baru. **PORTED**
  2026-10-01 ke `apps/worker/src/modules/contacts/service.ts`
  (`resolveContactId`), DIVERIFIKASI secara statis (belum ada entry
  point HTTP yg memanggilnya — `debts` manual SENGAJA di-skip, lihat
  `apps/worker/docs/todos/done/cloud-sync.md`).
- Format tanggal lokal custom (`now()` ISO-lokal tanpa offset,
  BEDA dari `datetime('now')` SQLite yg pakai spasi bukan `"T"`) —
  dipakai konsisten di 4 titik (`use-create-transaction.ts`,
  `use-update-transaction.ts` implisit, `use-correct-account-balance.ts`,
  `use-pay-debt.ts`, `use-create-debt.ts`). MCP tool WAJIB pakai format
  string yang sama persis, karena `formatDate()` di UI desktop
  mendeteksi ada/tidaknya komponen waktu lewat cek literal `"T"` pada
  string — format beda bisa merusak parsing tanggal secara senyap.
  **KOREKSI 2026-10-05 — premis "harus SAMA PERSIS" SALAH**: `now()`
  yang disebut di sini dipakai utk timestamp AKSI (kapan transaksi
  DIBUAT), BUKAN field `date` (kapan transaksi TERJADI, yang diisi
  user via `<FormFieldDate>`, `type="datetime-local"` — selalu
  mengandung `"T"`). Juga `nowText()` Worker (`shared/lww.ts`) itu utk
  kolom `updated_at`/metadata sync, dibandingkan sbg string LWW, TIDAK
  PERNAH lewat `formatDate()` — beda keperluan total dari field `date`.
  Yang sebenarnya relevan: field `date` DARI TOOL MCP cuma
  `z.string().describe("Format YYYY-MM-DD")` DI apps/mcp-server, bukan
  divalidasi beneran (describe cuma hint prompt), dan Worker cuma cek
  `typeof === "string"` — string APA PUN dari Claude lolos, bukan cuma
  beda format dgn desktop tapi bisa jadi string yang sama sekali bukan
  tanggal valid (`new Date(value)` jadi Invalid Date saat di-pull ke
  desktop). INI bug nyatanya, bukan soal "harus sama persis dgn PC".
- Attachment lifecycle (upload async setelah transaksi sukses, gagal
  non-fatal) — di luar D1 sama sekali (file lokal PC), tidak relevan
  utk tool MCP kecuali nanti ada fitur upload attachment dari HP.

## Di luar scope (dicatat, TIDAK direkomendasikan direplikasi ke MCP tool tulis)

- `src/features/retailku/**` — sync AR/AP dari POS eksternal, FIFO
  settlement lebih kompleks dari #1, TAPI ini pull dari sistem lain
  bukan CRUD user manual — tetap WAJIB dihormati kalau tool MCP generic
  menyentuh baris hasil sync Retailku: field `source`/`source_ref`
  idempotency key jangan sampai dobel insert.
- `src-tauri/src/import/money_manager/**` — importer bulk destruktif,
  wipe+reinsert, tool migrasi sekali-jalan, tidak relevan utk CRUD
  incremental.

## Keputusan yang sudah diambil dari audit ini

- [x] **Logic DITULIS ULANG di server (bukan diekstrak jadi shared
      logic)** — app desktop React+SQLite lokal vs server Node/Worker+D1
      beda runtime total, tidak realistis dibagi kode langsung. Port
      manual per fungsi, jaga tetap sinkron manual saat ada perubahan
      (risiko drift diterima, sama seperti trade-off LWW vs log —
      konsisten dgn preferensi "jangan over-engineer").

## Checklist porting (belum dikerjakan — untuk Tahap 4/5 di `apps/worker/docs/todos/done/cloud-sync.md`)

- [x] Port `applyDebtTransaction`/`settleDebtsFifo` ke Worker —
      `apps/worker/src/modules/debts/service.ts`, dipanggil dari
      `apps/worker/src/modules/transactions/service.ts` setelah insert
      transaksi (pola "modul pemilik vs pemicu"). DIVERIFIKASI
      end-to-end di production: cash→debt (piutang baru), settlement
      parsial+penuh via FIFO (status `ongoing`→`paid` tepat waktu).
- [x] Port `applyDebtTransactionEdit` + `DebtEditBlockedError` ke Worker
      — SELESAI 2026-10-01, `apps/worker/src/modules/debts/service.ts`
      (`applyDebtTransactionEdit`, `getTransactionDebtStatus`), dipanggil
      dari `transactions/service.ts` (`updateTransaction`) via endpoint
      `PATCH /transactions/:id`. DIVERIFIKASI end-to-end di production:
      field berbahaya pada `principal` tanpa cicilan → recreate aman;
      field berbahaya pada `principal` DENGAN cicilan → 422 blocked,
      baris `transactions` TERBUKTI tidak ter-update.
- [x] Port validasi nominal pelunasan ≤ sisa piutang ke Worker —
      **CELAH DITUTUP** 2026-10-01, fungsi
      `validateDebtSettlementAmount()` di `debts/service.ts`, dipanggil
      sbg pre-check SEBELUM tulis baris `transactions` apa pun (bukan di
      dalam `settleDebtsFifo` spt dugaan awal — dipindah krn temuan
      atomicity: reject SETELAH tulis akan menyisakan baris transaksi
      yatim, lihat catatan lengkap di
      `apps/worker/docs/todos/done/cloud-sync.md`). DIVERIFIKASI: amount
      jauh > sisa → 422, 0 baris transaksi tersimpan; amount pas = sisa
      → 201 ok, status piutang jadi `paid`.
- [x] Port larangan income/expense di akun `debt` ke Worker —
      `apps/worker/src/modules/transactions/service.ts`
      (`violatesDebtAccountRule()`), jadi VALIDASI KERAS (HTTP 422
      reject) — BEDA dari desktop yg auto-correct via form, Worker
      tidak punya UI utk itu. DIVERIFIKASI end-to-end di production.
- [x] Port formula saldo akun ke Worker — `apps/worker/src/modules/accounts/service.ts`
      (`getAccountBalance()`), endpoint `GET /accounts/balance`.
      DIVERIFIKASI end-to-end di production.
- [x] Port logic koreksi saldo manual ke Worker — `apps/worker/src/modules/accounts/service.ts`
      (`correctAccountBalance()`), endpoint `POST /accounts/correct-balance`.
      DIVERIFIKASI end-to-end di production.
- [x] Port `dangerousFieldsChanged` comparison ke Worker — SELESAI
      2026-10-01, `apps/worker/src/modules/transactions/service.ts`
      (fungsi `dangerousFieldsChanged`), dipanggil dari
      `updateTransaction` sebelum UPDATE baris `transactions` dijalankan.
- [x] Putuskan & implementasikan kebijakan reassign/unassign delete account/category/group — SELESAI 2026-10-01.
- [x] Putuskan & implementasikan filter `category.type === transaction.type` di Worker —
      SELESAI 2026-10-05, `apps/worker/src/modules/transactions/service.ts`
      (`getCategoryType`/`validateCategoryExists`, digabung dgn precheck
      exists yg sudah ada karena sama-sama butuh baca row `categories` yg
      sama). Berlaku di jalur CREATE dan UPDATE, income/expense ditolak
      422 kalau `category.type` beda dari `transaction.type`; transfer
      dikecualikan (tidak pernah divalidasi type-nya, cuma exists).
      **Bug ditemukan sambil lewat**: `createTransactionRow` masih INSERT
      `payload.categoryId` mentah tanpa null-kan untuk transfer (beda
      dari `updateTransactionRow` yg sudah benar) — item checklist
      "Port auto-null `category_id` pada transfer" DITUTUP SEKALIGUS,
      diperbaiki jadi `payload.type === "transfer" ? null : payload.categoryId`
      persis pola UPDATE. `tsc --noEmit` lolos bersih, TIDAK ADA test
      suite Worker (belum ada framework test terpasang) jadi belum
      diverifikasi end-to-end production — PR lanjutan kalau mau
      memverifikasi lewat `wrangler dev`/curl manual.
- [x] Putuskan & implementasikan definisi tunggal formula `remaining` —
      SELESAI 2026-10-05, `apps/desktop/src/shared/debts/remaining-debt-sql.ts`
      (`remainingDebtSql()`/`sumDebtPaymentsSql()`, generator fragment SQL
      — BUKAN computed di JS, supaya tetap bisa di-SORT/FILTER di level
      SQL seperti sebelumnya; SQLite di sini tidak dipakai lewat ORM/VIEW,
      jadi "sumber tunggal" diwujudkan sbg satu fungsi TS yang
      di-generate ulang di tiap query). Dipakai di SEMUA 5 titik yang
      disebut audit: `use-ongoing-debts.ts`, `use-debts-list.ts`,
      `use-contact-debts.ts` (TIDAK disebut eksplisit di audit tapi
      ternyata py rumus sama), `use-contact-summary.ts` (2 titik,
      `receivable_remaining`/`payable_remaining`), dan
      `apply-debt-transaction.ts` (`settleDebtsFifo`).
      **DRIFT NYATA ditemukan tepat seperti yang diprediksi audit**:
      subquery `remaining` di `settleDebtsFifo` (dipakai alokasi FIFO
      saat pelunasan) LUPA filter `debt_payments.deleted_at IS NULL` —
      beda dari 4 tempat lain yang sudah benar. Artinya kalau ada
      `debt_payments` yang soft-deleted, `remaining` yang dipakai utk
      alokasi FIFO bisa lebih kecil dari seharusnya (payment terhapus
      masih ikut dikurangkan), piutang/utang bisa teralokasi salah.
      Diperbaiki otomatis begitu diganti ke `remainingDebtSql()`.
      Full test suite desktop (172 test, 23 file, termasuk
      `apply-debt-transaction.test.ts`) + `tsc --noEmit` 0 regresi.
      **BELUM dikerjakan**: Worker (`apps/worker/src/modules/debts/service.ts`)
      punya definisi `remaining`/`getAccountBalance` SENDIRI (port
      manual, BUKAN shared code dgn desktop — lihat keputusan "logic
      ditulis ulang di server" di atas), jadi util ini BELUM
      menghilangkan risiko drift desktop↔Worker, cuma drift ANTAR-FILE
      di desktop sendiri. Formula `balance` (bukan `remaining`) juga
      belum disentuh sesi ini — scope sesi ini cuma `remaining`
      piutang/utang.
- [x] Putuskan & implementasikan guard delete transaksi terhadap
      debt/payment terkait — SELESAI 2026-10-03 (lihat catatan di
      bagian "Perlu keputusan desain eksplisit" di atas) —
      `detachDebtForDeletedTransaction` di desktop & Worker.
- [x] Validasi format tanggal MCP tool — SELESAI 2026-10-05,
      `apps/mcp-server/src/lib/date-field.ts` (`dateField`, Zod
      `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`), dipasang di 4 titik:
      `transactionFields.date` (dipakai `create_transaction` DAN
      `update_transaction` lewat shared field), `create_debt_direct`,
      `pay_debt_non_cash`. **BUKAN "samakan dgn `now()` desktop"**
      seperti dugaan awal audit (premis itu salah, lihat koreksi di
      atas) — field `date` dari PC (datetime-local, selalu ada `"T"`)
      dan dari MCP (date-only, `YYYY-MM-DD`) TETAP beda format scr
      desain, keduanya sama-sama valid utk `formatDate()` (yang
      fallback `${value}T00:00` kalau tidak ada `"T"`). Yang diperbaiki
      murni: Claude sebelumnya bisa kirim string APA PUN (termasuk yang
      sama sekali bukan tanggal valid) tanpa ditolak — sekarang ditolak
      di titik masuk (MCP, Zod) sebelum sempat terkirim ke Worker.
      Worker SENGAJA TIDAK diketatkan (masih `typeof === "string"`
      polos) krn dia menerima dari 2 sumber dgn kontrak format beda
      (PC vs MCP) — mengetatkan ke salah satu format akan menolak data
      sah dari sumber lain. `tsc --noEmit` mcp-server lolos bersih,
      BELUM diverifikasi end-to-end (belum ada test suite mcp-server).
      **Temuan sampingan (BELUM ditutup, di luar scope item ini)**:
      `apps/mcp-server/src/lib/sync-snapshot.ts` (`summarizeDebts`,
      `listDebtDetails`) ternyata py rumus `remaining` SENDIRI (`amount -
      paid`), tempat KE-6 yang belum ikut dipakaikan `remainingDebtSql()`
      — util itu cuma dipakai sisi desktop (SQL fragment utk SQLite
      lewat Tauri), sedangkan sync-snapshot.ts murni JS di atas data
      JSON hasil `/sync` Worker, jadi tidak bisa reuse langsung. Dicatat
      sbg potensi drift lanjutan, belum dikerjakan sesi ini.

## Terkait

- [`../../../../worker/docs/todos/done/cloud-sync.md`](../../../../worker/docs/todos/done/cloud-sync.md)
  — dokumen UTAMA: semua keputusan sync/arsitektur/conflict resolution,
  progress implementasi Worker, checklist Tahap 4/5 yang merujuk ke
  checklist porting di dokumen ini.
- [`mcp-server-cloud-mirror.md`](./mcp-server-cloud-mirror.md) —
  dokumen sisi PC: migrasi lokal, integrasi UI Settings.
- `docs/todos/done/uuid-migration.md` — sesi migrasi UUID yang pertama
  kali menyebut `apply-debt-transaction.ts` sbg titik paling kritis.
