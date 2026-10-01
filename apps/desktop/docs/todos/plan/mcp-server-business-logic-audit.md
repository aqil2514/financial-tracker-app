# Audit Logic Bisnis yang Perlu Direplikasi ke Server (MCP CRUD)

> Dipecah dari `mcp-server-cloud-mirror.md` Tahap 2 (2026-09-30) supaya
> dokumen utama tidak terlalu panjang. Dokumen ini KHUSUS berisi hasil
> audit + checklist porting logic bisnis, dan TETAP di `apps/desktop`
> (bukan pindah ke `apps/worker`) krn isinya murni audit kode desktop
> (file:baris spesifik di `src/features/*` dst) — meski dipakai sbg
> checklist porting ke Worker. Semua keputusan sync/conflict
> resolution/arsitektur MCP ada di
> [`apps/worker/docs/todos/plan/cloud-sync.md`](../../../../worker/docs/todos/plan/cloud-sync.md)
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
  - **Keputusan yang perlu diambil**: apakah tool MCP "delete
    account/category/group" WAJIB menerima parameter reassign target
    (setara UI), atau cukup selalu berperilaku "unassign" default dan
    terima konsekuensinya.
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
  (baik dari PC maupun rencana tool MCP). Juga: delete transaksi TIDAK
  menghapus file attachment fisik di disk (row `transaction_attachments`
  CASCADE, file-nya orphan) — relevan dicatat karena file lokal di luar
  jangkauan D1 sama sekali.

## Boleh diabaikan / ditangani longgar (risiko RENDAH)

- Dedup kontak fuzzy (Levenshtein ≤2 di `find-similar-contacts.ts`,
  hanya warning UI non-blocking) — bisa diserahkan ke tool caller
  (Claude) utk exact-match saja; auto-create by exact name via
  `resolve-contact.ts:11-25` tetap perlu direplikasi (bukan opsional)
  supaya nama bebas dari HP tidak selalu bikin kontak baru. **PORTED**
  2026-10-01 ke `apps/worker/src/modules/contacts/service.ts`
  (`resolveContactId`), DIVERIFIKASI secara statis (belum ada entry
  point HTTP yg memanggilnya — `debts` manual SENGAJA di-skip, lihat
  `apps/worker/docs/todos/plan/cloud-sync.md`).
- Format tanggal lokal custom (`now()` ISO-lokal tanpa offset,
  BEDA dari `datetime('now')` SQLite yg pakai spasi bukan `"T"`) —
  dipakai konsisten di 4 titik (`use-create-transaction.ts`,
  `use-update-transaction.ts` implisit, `use-correct-account-balance.ts`,
  `use-pay-debt.ts`, `use-create-debt.ts`). MCP tool WAJIB pakai format
  string yang sama persis, karena `formatDate()` di UI desktop
  mendeteksi ada/tidaknya komponen waktu lewat cek literal `"T"` pada
  string — format beda bisa merusak parsing tanggal secara senyap.
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

## Checklist porting (belum dikerjakan — untuk Tahap 4/5 di `apps/worker/docs/todos/plan/cloud-sync.md`)

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
      `apps/worker/docs/todos/plan/cloud-sync.md`). DIVERIFIKASI: amount
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
- [ ] Putuskan & implementasikan kebijakan reassign/unassign delete account/category/group.
- [ ] Putuskan & implementasikan filter `category.type === transaction.type` di Worker.
- [ ] Port auto-null `category_id` pada transfer ke Worker.
- [ ] Putuskan & implementasikan definisi tunggal formula `remaining`/`balance` (shared util/VIEW) sebelum port lanjut.
- [ ] Putuskan & implementasikan (atau sadar-terima ketiadaan) guard delete transaksi terhadap debt/payment terkait.
- [ ] Pastikan format tanggal MCP tool sama persis dgn `now()` lokal desktop.

## Terkait

- [`../../../../worker/docs/todos/plan/cloud-sync.md`](../../../../worker/docs/todos/plan/cloud-sync.md)
  — dokumen UTAMA: semua keputusan sync/arsitektur/conflict resolution,
  progress implementasi Worker, checklist Tahap 4/5 yang merujuk ke
  checklist porting di dokumen ini.
- [`mcp-server-cloud-mirror.md`](./mcp-server-cloud-mirror.md) —
  dokumen sisi PC: migrasi lokal, integrasi UI Settings.
- `docs/todos/done/uuid-migration.md` — sesi migrasi UUID yang pertama
  kali menyebut `apply-debt-transaction.ts` sbg titik paling kritis.
