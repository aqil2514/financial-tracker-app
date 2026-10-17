# Arah Akun Utang Piutang (`debt_accounts`)

## Status & TODO saat ini (ringkas)

Penjelasan lengkap kenapa tiap poin ada di sini — lihat bagian "Latar belakang", "Bug kedua yang ditemukan", dan "Rencana pendekatan" di bawah.

- [x] Migrasi skema: tabel detail `debt_accounts` (1:1 dengan `accounts`, pola sama `investment_accounts`), kolom `direction` — migrasi `0050_debt_accounts.sql` (awalnya `'receivable' | 'payable' | 'both'`), lalu `0051_debt_accounts_direction_required.sql` **menghapus opsi `'both'`** (lihat "Perubahan besar dari rencana awal" di bawah).
- [x] Backfill data existing — dilakukan di migrasi 0050 untuk 3 akun debt produksi (semua sudah benar arahnya, tidak ada yang perlu direklasifikasi saat migrasi 0051 mengetatkan constraint).
- [x] Form "Tambah Akun" (`features/accounts/`): field "Arah" (`field-debt.tsx`) muncul kondisional saat `account_type === 'debt'`, hanya 2 opsi (Piutang/Utang, tanpa "Keduanya").
- [x] `new-debt-form.tsx`: dropdown "Akun Utang Piutang" difilter berdasar `direction` yang cocok `debt_type` form — auto-select kalau cuma 1 opsi cocok, pesan eksplisit kalau tidak ada akun yang cocok.
- [x] `applyDebtTransaction` (`apply-debt-transaction/create.ts`): **ditulis ulang total**, bukan cuma "validasi keras ditambahkan" seperti rencana awal — `direction` akun debt sekarang jadi SATU-SATUNYA sumber kebenaran untuk `debts.type` di Jalur 1 (transfer), parameter `debtAction` yang dulu dikirim dari UI dihapus total (lihat "Perubahan besar dari rencana awal"). Error baru `DebtAccountDirectionMissingError` kalau akun debt belum punya `direction` ter-set.
- [x] UI jalur transfer (`field-debt-action.tsx`, `use-transaction-debt-fields.ts`, `use-transaction-form.ts`, `use-ongoing-debts.ts`): toggle "Pelunasan vs Utang baru" **dihapus** — arah ditentukan otomatis dari `direction` akun, bukan pilihan manual user. *(Belum dikomit saat dokumen ini ditulis — lihat "Riwayat implementasi".)*
- [x] **Jalur 2 CREATE** (`create-transaction/income/debt.ts`, `.../expense/debt.ts`): ditulis ulang — fungsi baru `applyDirectDebtTransaction` (`apply-debt-transaction/apply-direct-debt-transaction.ts`) menentukan lahir-baru vs pelunasan FIFO dari `debt_accounts.direction`, menggantikan hardcode lama (income selalu → `receivable`, expense selalu → `payable`) yang sudah terbukti SALAH — ini persis bug original yang memulai investigasi ini. UI (`use-transaction-debt-fields.ts`) ikut direvisi supaya checklist pelunasan muncul untuk income/expense juga, bukan cuma transfer. Test baru `apply-direct-debt-transaction.test.ts`. Dikomit `4a8f04b`, diverifikasi manual `tauri dev` (lihat "Riwayat implementasi").
- [x] **Jalur 2 UPDATE** (`update-transaction/income/debt.ts`, `.../expense/debt.ts`): ditulis ulang — fungsi baru `applyDirectDebtTransactionEdit` (`apply-debt-transaction/apply-direct-debt-transaction-edit.ts`), struktur paralel `applyDebtTransactionEdit` (Jalur 1) tapi mendelegasikan ke `applyDirectDebtTransaction`. Guard lama yang menolak edit transaksi ber-role `'payment'` (`throw new Error(...)`) **dihapus** — sekarang di-recreate dengan benar seperti Jalur 1, bukan diblokir total. Test baru `apply-direct-debt-transaction-edit.test.ts` (8 skenario: none/principal/payment × locked/recreate/sync-date). *(Belum dikomit.)*
- [x] **Port skema + validasi ke `apps/worker`** — scope dibatasi `createDirectDebt` saja (keputusan user, bukan `applyDebtTransaction`/transfer flow Worker). Migrasi D1 baru `0007_debt_account_direction.sql` (tabel `debt_accounts`, pola identik `investment_accounts`), `AccountPayload`/`upsertAccount` (`accounts/schema.ts`, `accounts/service.ts`) terima field `direction` opsional, `createDirectDebt` (`debts/service.ts`) sekarang WAJIB validasi `direction` akun vs `payload.type` SEBELUM insert/update (reject 422 kalau mismatch atau akun belum punya direction). **Bug pre-existing ditemukan & diperbaiki saat verifikasi** (di luar scope awal, bukan regresi dari perubahan ini): `createDebtClosingTransaction` kirim `note: null` padahal kolom `transactions.note` `NOT NULL` di D1 — `createDirectDebt` SELALU gagal 500 kalau payload tidak menyertakan `note` (field opsional di schema). Fix: `note ?? ""`. Diverifikasi manual `wrangler dev --local` (4 skenario, lihat "Riwayat implementasi — Worker"). *(Belum dikomit.)*
- [x] **Verifikasi tool MCP `create_debt_direct`** (`apps/mcp-server/src/lib/mcp-tools/debts/create-debt-direct.ts`) — deskripsi tool + schema Zod `type`/`accountId` diperbarui menyebut constraint arah akun secara eksplisit. `workerFetch` sudah meneruskan pesan reject Worker apa adanya ke LLM (tidak perlu perubahan, pola existing proyek). **Scope meluas**: `debt_accounts.direction` sebelumnya TIDAK ADA SAMA SEKALI di snapshot sync MCP (`GET /sync`) — ditambahkan (Worker: `sync/service/entities/debt-accounts.ts` baru + didaftarkan di `sync/service/index.ts`; MCP: `DebtAccount` type baru + field `debtDirection` di `get_account_balances`) supaya LLM BENERAN bisa cek arah akun SEBELUM memanggil `create_debt_direct`, bukan cuma mengandalkan reject setelahnya. Lihat "Riwayat implementasi — MCP".
- [x] ~~Cleanup baris `debts` lama yang salah kategori~~ (`01a13e62-cf6d...` kontak Kak Ipit, `01a14492-eb7f...` data uji coba) — **ditutup, keputusan user 2026-10-17, TIDAK dikerjakan** (kedua baris tetap ada di `finance.dev.db` apa adanya saat item ini ditutup — dicek langsung, bukan diasumsikan). Kalau suatu saat perlu dibersihkan, tetap lewat UI manual, BUKAN lewat SQL langsung.
- [x] **Worker `applyDebtTransaction`** (transfer flow cash↔debt lewat `POST /transactions`) — awalnya sengaja ditunda, lalu DIKERJAKAN juga atas persetujuan user lanjutan 2026-10-17. `debtAction` (dulu dipercaya mentah dari client) **dihapus total** dari logic — diganti `resolveDebtTransactionOutcome` (fungsi baru) yang derive arah dari `debt_accounts.direction`, dipakai di 3 titik: precheck create (`createTransactionRow`), precheck update (`updateTransactionRow`), dan `applyDebtTransaction` sendiri. Lihat "Riwayat implementasi — Worker transfer flow".
- [x] Smoke test manual desktop untuk Jalur 1 — diverifikasi langsung ke `finance.dev.db` (bukan cuma toast UI) tanggal 2026-10-17, lihat "Riwayat implementasi".
- [x] **Migrasi D1 production + deploy Worker** — `0007_debt_account_direction.sql` dijalankan `wrangler d1 execute financial-app --file=schema/0007_debt_account_direction.sql --remote` (percobaan pertama gagal `Authentication error [code: 10000]`, token OAuth Wrangler basi — sukses setelah retry/re-auth), tabel `debt_accounts` diverifikasi ADA di D1 production lewat `SELECT sql FROM sqlite_master`. `wrangler deploy` dijalankan user (`npm run deploy:worker`), sukses — Version ID `1ca5d397-99d8-4e57-9afd-d2cb7218eb99`, live di `https://financial-app-worker.muhamadaqil383.workers.dev`. Semua kode Worker/MCP sesi ini (commit `4ffe9f4`) sekarang AKTIF di production, bukan cuma lokal.

## Perubahan besar dari rencana awal

Dua hal berubah signifikan dari rencana yang ditulis pertama kali di bawah ("Rencana pendekatan") — dokumen itu ditulis SEBELUM bug kedua ditemukan via dogfooding lanjutan. Bagian "Rencana pendekatan" di bawah dipertahankan apa adanya sebagai catatan sejarah/alasan desain awal, tapi detail berikut sudah menggantikannya:

### 1. `direction = 'both'` dihapus total, bukan dipertahankan untuk akun netral

Rencana awal mempertahankan `'both'` untuk akun generik seperti "Keluarga"/"Orang Lain"/"Bisnis" yang secara histori dipakai dua arah. Setelah didiskusikan ulang, diputuskan: **setiap akun debt WAJIB `receivable` ATAU `payable`, tidak ada netral.** Kalau kebutuhannya mencatat dua arah ke pihak yang sama, itu harus dua akun terpisah (mis. "Piutang Keluarga"/"Utang Keluarga"), bukan satu akun ambigu — karena `direction` sekarang bukan cuma dipakai filter dropdown UI, tapi jadi SATU-SATUNYA input untuk menentukan `debts.type` secara otomatis di `applyDebtTransaction`. Akun `'both'` akan membuat logika itu tidak mungkin ditentukan tanpa input tambahan dari user, yang justru kembali ke masalah "bisa salah pilih" yang ingin dihindari.

Migrasi `0051_debt_accounts_direction_required.sql` mengetatkan `CHECK` constraint ini. Dicek langsung: produksi tidak punya satu pun akun `'both'` yang perlu direklasifikasi (semua 3 akun debt produksi sudah `receivable`/`payable` sejak backfill 0050).

### 2. Ditemukan bug KEDUA via dogfooding lanjutan: arah Jalur 1 (transfer) sendiri awalnya salah logic, dan ada Jalur 2 yang sama sekali belum tercakup rencana awal

Setelah rencana awal ("Rencana pendekatan" di bawah) diimplementasikan parsial, user menemukan transaksi **income** langsung di akun debt `payable` ("Test Utang Baru") melahirkan `debts.type='receivable'` — bukan mengurangi utang seperti seharusnya. Investigasi mengungkap bahwa aturan arah yang benar TIDAK bisa diturunkan dari "uang masuk = bertambah" secara naif (itu kontradiktif untuk Jalur 1 transfer: bayar utang dengan kas MENGURANGI utang, padahal kas "masuk" ke akun debt). Setelah dikoreksi berkali-kali oleh user, aturan final yang disepakati dan sudah diverifikasi konsisten secara logika — didokumentasikan penuh di [docs/concept/konsep-utang-piutang.md](../../../../../docs/concept/konsep-utang-piutang.md):

**Jalur 1 — transfer kas ↔ akun debt:**

| `direction` akun | Arah transfer | Efek |
|---|---|---|
| `payable` | Kas → akun (masuk) | Utang **berkurang** (pelunasan FIFO) |
| `payable` | Akun → kas (keluar) | Utang **bertambah** (debt baru) |
| `receivable` | Kas → akun (masuk) | Piutang **bertambah** (debt baru) |
| `receivable` | Akun → kas (keluar) | Piutang **berkurang** (pelunasan FIFO) |

**Jalur 2 — income/expense langsung di akun debt (belum diimplementasikan di kode):**

| `direction` akun | `type` transaksi | Efek |
|---|---|---|
| `payable` | income | Utang **berkurang** |
| `payable` | expense | Utang **bertambah** (debt baru) |
| `receivable` | income | Piutang **bertambah** (debt baru) |
| `receivable` | expense | Piutang **berkurang** |

Jalur 1 sudah diimplementasikan dan diverifikasi sesuai tabel ini (lihat "Riwayat implementasi"). Jalur 2 masih memakai logika lama yang SALAH untuk kombinasi `payable`+income dan `receivable`+expense — ini adalah pekerjaan utama yang tersisa.

## Riwayat implementasi (Jalur 1)

Dikerjakan dan dikomit `c8280a4` ("Fix konsep utang piutang & penerapan jalur create & unitest"), 2026-10-17:

- `apply-debt-transaction/create.ts` ditulis ulang: parameter `debtAction` (dulu dikirim UI, menentukan "settlement" vs "payable" secara manual) dihapus total. Fungsi sekarang membaca `debt_accounts.direction` lewat `requireDebtAccountDirection()`, throw `DebtAccountDirectionMissingError` kalau akun debt belum punya baris `debt_accounts` sama sekali.
- Comment panjang di kode dipindah ke [apply-debt-transaction/README.md](../../../../src/shared/debts/apply-debt-transaction/README.md) (instruksi eksplisit user: kode minim komentar).
- Test baru `apply-debt-transaction/create.test.ts` (file terpisah, bukan digabung ke test combined lama) — cakupan: income/expense no-op di jalur ini (ditangani Jalur 2 terpisah), semua `AccountPairKind` (`cash-cash`, `debt-debt`, `cash-investment` no-op; `UnsupportedAccountPairError`), `cash-debt`+`receivable` → debt baru, `cash-debt`+`payable` → FIFO settlement, `debt-cash`+`payable` → debt baru, `debt-cash`+`receivable` → FIFO settlement, `DebtAccountDirectionMissingError` untuk kedua arah transfer.
- Bug tambahan ditemukan & diperbaiki saat memperbaiki caller: `pay-debt-form/use-pay-debt.ts` (tombol "Bayar" cepat) selalu mengasumsikan arah transfer `debt → kas`, salah untuk debt `payable` di bawah aturan baru — diperbaiki jadi branch berdasar `debt.type`.
- Diverifikasi ke `finance.dev.db` langsung (bukan cuma toast UI, sesuai [checking-dev-database.md](../checking-dev-database.md)) tanggal 2026-10-17: 4 transaksi uji manual (expense di akun payable, income di akun receivable, transfer masuk/keluar keduanya) — semua `debts.type` dan `debt_payments` yang lahir cocok 100% dengan tabel Jalur 1 di atas.

**Belum dikomit** (status working tree saat dokumen ini ditulis): perbaikan UI lanjutan supaya field checklist pelunasan muncul untuk kombinasi `pairKind`+`direction` yang benar (sebelumnya field itu cuma muncul untuk `debt-cash`, sehingga kombinasi `cash-debt`+`payable` — yang butuh pelunasan FIFO juga — silent no-op karena `settleDebtIds` kosong tidak pernah terisi UI). Perubahan: `use-ongoing-debts.ts` (parameter `type` eksplisit, bukan hardcode `receivable`), `use-transaction-debt-fields.ts` (computed `settlementDirection` dari `pairKind`+`direction`), `use-transaction-form.ts`, `field-debt-action.tsx` (toggle lama dihapus, label checklist dinamis), `transactionSchema`/`values.ts` (field `debt_action` dihapus). Juga ikut dibersihkan 6 file sisa referensi tipe `'both'` yang luput saat migrasi 0051. Diverifikasi `tsc --noEmit` bersih + `vitest run` 251/251 lulus.

Ditemukan saat verifikasi manual Jalur 1 di atas: user sempat menguji income/expense langsung di akun debt juga (bukan cuma transfer) dan hasilnya tampak benar — tapi itu KEBETULAN, bukan bukti Jalur 2 sudah benar (lihat "Bug kedua" di atas). 2 dari 4 kombinasi (`payable`+expense, `receivable`+income) kebetulan cocok dengan hardcode lama; 2 kombinasi lain (`payable`+income, `receivable`+expense) akan tetap salah kalau dicoba.

## Riwayat implementasi (Jalur 2 — CREATE)

Dikerjakan 2026-10-17, sesi lanjutan setelah Jalur 1, dikomit `4a8f04b` ("Fix jalur create utang piutang"):

- Fungsi baru `applyDirectDebtTransaction` (`apply-debt-transaction/apply-direct-debt-transaction.ts`) — reuse `requireDebtAccountDirection`/`createDebt` (diekspor dari `create.ts`) dan `settleDebtsFifo` (`settle-fifo.ts`, generik, tidak terikat tipe transaksi). Logic: `direction='payable'`+`expense` atau `direction='receivable'`+`income` → `createDebt`; kombinasi sebaliknya → `settleDebtsFifo`.
- `create-transaction/income/debt.ts` dan `.../expense/debt.ts` ditulis ulang: `INSERT INTO debts` hardcode langsung dihapus, diganti panggilan `applyDirectDebtTransaction` dengan `settleDebtIds: values.settle_debt_ids` (field form yang sama dipakai Jalur 1).
- `use-transaction-debt-fields.ts`: `settlementDirection`/`involvesDebtAccount` diperluas mencakup `type === "income"`/`"expense"` (sebelumnya cuma `type === "transfer"`) — supaya checklist pelunasan muncul di form untuk kombinasi `payable`+income dan `receivable`+expense juga.
- Test baru `apply-direct-debt-transaction.test.ts` (file terpisah, pola sama `create.test.ts`) — 6 test: `payable`+expense → debt baru, `receivable`+income → debt baru, `payable`+income → FIFO settlement, `receivable`+expense → FIFO settlement, `settleDebtIds` kosong → no-op, `DebtAccountDirectionMissingError`.
- Diverifikasi `tsc --noEmit` bersih + `vitest run` 257/257 lulus (33 file), **DAN** diverifikasi manual `tauri dev`: income Rp5.000.000 di akun "Test Utang Baru" (`payable`, sisa utang Rp20.000.000) → sisa utang turun jadi Rp15.000.000 ("Berjalan"), TIDAK melahirkan piutang baru — sesuai ekspektasi.

## Riwayat implementasi (Jalur 2 — UPDATE)

Dikerjakan 2026-10-17, sesi lanjutan setelah Jalur 2 Create dikomit:

- Fungsi baru `applyDirectDebtTransactionEdit` (`apply-debt-transaction/apply-direct-debt-transaction-edit.ts`) — struktur IDENTIK `applyDebtTransactionEdit` (`edit.ts`, Jalur 1) tapi mendelegasikan ke `applyDirectDebtTransaction`, bukan `applyDebtTransaction`. `DebtEditBlockedError`/`DebtSelfSettlementError` diimpor ulang dari `edit.ts` (pesannya generik, tidak terikat "transfer").
- `update-transaction/income/debt.ts` dan `.../expense/debt.ts` ditulis ulang total: implementasi manual lama (branch `status.role` + `INSERT INTO debts` hardcode) dihapus, diganti panggilan `applyDirectDebtTransactionEdit`.
- **Bug tambahan ditemukan & diperbaiki saat rewrite**: kode lama secara eksplisit MENOLAK edit transaksi ber-`status.role === 'payment'` (`throw new Error("Transaksi ini tercatat sebagai cicilan...")`) — padahal edit transaksi cicilan seharusnya AMAN di-recreate (tidak ada yang bergantung pada satu baris `debt_payments`), persis seperti Jalur 1 sudah menangani. Guard itu dihapus; `applyDirectDebtTransactionEdit` sekarang menangani ketiga role (`none`/`principal`/`payment`) dengan benar.
- **Perubahan perilaku kecil, disetujui eksplisit oleh user**: `debts.note` tidak lagi diisi dari `values.note` seperti implementasi lama — `createDebt` yang dipakai ulang dari Jalur 1 tidak punya parameter note (Jalur 1 sejak awal tidak pernah mengisi kolom ini). Data tidak hilang (tetap bisa diakses lewat `transaction_id` → `transactions.note`), cuma tidak diduplikasi ke `debts.note`.
- Test baru `apply-direct-debt-transaction-edit.test.ts` (8 test): role `none` (= create), `principal` tanpa field berbahaya berubah (sync date), `principal` + berbahaya + sudah dicicil (blokir), `principal` + berbahaya + belum dicicil (recreate), `principal` recreate dengan self-settlement (blokir), `payment` tanpa field berbahaya berubah (sync date), `payment` + berbahaya berubah (recreate FIFO), kombinasi `receivable`+expense lewat role `none`.
- Diverifikasi `tsc --noEmit` bersih + `vitest run` 265/265 lulus (34 file), **DAN** diverifikasi manual `tauri dev`: edit transaksi "Diikhlasin 5jt" (income di "Test Utang Baru", semula Rp5.000.000) — checklist "Pilih utang yang dilunasi" muncul benar dengan sisa Rp20.000.000 (exclude pembayaran transaksi ini sendiri, sesuai desain `use-ongoing-debts.ts`), nominal diubah jadi Rp7.000.000 → sisa utang jadi Rp13.000.000 (bukan Rp15.000.000/salah hitung), saldo akun "Test Utang Baru" ikut konsisten -Rp13.000.000, tidak ada baris `debts`/`debt_payments` ganda. Recreate FIFO pada jalur edit terbukti benar. **Belum dikomit.**

## Riwayat implementasi (Worker — `createDirectDebt`)

Dikerjakan 2026-10-17, sesi lanjutan setelah Jalur 2 Update (desktop):

- Migrasi `apps/worker/schema/0007_debt_account_direction.sql` — `CREATE TABLE debt_accounts` murni (tidak perlu copy-and-rename, tidak ada data existing/tidak mengubah CHECK constraint apa pun), pola identik `investment_accounts` di `0002_account_type_investment.sql` TAPI ditambah `updated_at`/`deleted_at`/`sync_source` (LWW standar Worker, desktop tidak punya kolom ini). Diterapkan ke D1 lokal via `wrangler d1 execute financial-app --file=schema/0007_debt_account_direction.sql --local`.
- `accounts/schema.ts` (`AccountPayload`) — field baru `direction?: "receivable" | "payable" | null`, divalidasi bentuknya di `isAccountPayload` tapi TIDAK diwajibkan (pola sama `unitLabel` investment — desktop kirim `accounts` dan `debt_accounts` sbg 2 request terpisah, mewajibkan di sini akan memblokir semua akun debt dari desktop).
- `accounts/service.ts` (`upsertAccount`) — blok upsert `debt_accounts` baru, pola identik blok `investment_accounts` yang sudah ada (insert-or-update tergantung baris existing), guarded `accountType === 'debt' && direction != null`.
- `debts/service.ts` — fungsi baru `getDebtAccountDirection` (port `requireDebtAccountDirection` desktop, tapi return nullable bukan throw — Worker pola reject via return value, bukan exception). Dipasang SEBELUM percabangan insert/update di `createDirectDebt`, jadi otomatis berlaku untuk KEDUA cabang: akun tanpa `direction` → reject ("belum punya arah... lengkapi dulu lewat update_account"), `payload.type` tidak cocok `direction` akun → reject ("arahnya 'X', tidak cocok dengan type 'Y'"). Catatan desain: mode `createDirectDebt` SELALU "lahir baru" (tidak ada cabang pelunasan/FIFO sama sekali di jalur ini, beda dari `applyDirectDebtTransaction` desktop) — jadi `direction` akun menjadi SATU-SATUNYA `type` yang valid, tidak ada ambiguitas yang perlu diselesaikan lewat `settleDebtIds` seperti di desktop.
- **Bug pre-existing ditemukan saat verifikasi manual, diperbaiki sekalian** (keputusan user, di luar scope awal validasi direction): `createDebtClosingTransaction` (dipanggil 3 tempat: `createDirectDebt`, dan 2 lokasi lain di `service.ts`) kirim `note` apa adanya (bisa `null`) ke `INSERT INTO transactions`, tapi kolom `transactions.note` adalah `NOT NULL` di skema D1 — `createDirectDebt` SELALU gagal `500 Internal Server Error` kalau payload tidak menyertakan `note` (field opsional di `CreateDirectDebtPayload`), ditemukan lewat `D1_ERROR: NOT NULL constraint failed: transactions.note` di observability log `wrangler dev`. Fix 1 baris: `note ?? ""`.
- Diverifikasi `npm run typecheck` (`tsc --noEmit`) bersih. **Tidak ada test runner di `apps/worker`** (tidak ada file `.test.ts`, tidak ada script test di `package.json`) — Worker diverifikasi manual via `wrangler dev --local` + `curl`, konsisten pola existing proyek ini.
- **Diverifikasi manual `wrangler dev --local` (4 skenario)**: (1) akun debt tanpa `debt_accounts` sama sekali → `POST /debts` reject dengan pesan jelas; (2) akun `direction='receivable'` + payload `type='payable'` (mismatch) → reject dengan pesan jelas; (3) akun `direction='receivable'` + payload `type='receivable'` (cocok) + `note` terisi → sukses, diverifikasi `debts`+`transactions` tersimpan benar (`type=receivable`, transaksi closing `type=income`); (4) ulangi skenario (3) TANPA `note` sama sekali setelah fix bug di atas → sukses (sebelumnya 500). Data uji dibersihkan dari D1 lokal setelah verifikasi.
- **Scope SENGAJA dibatasi `createDirectDebt` saja** (keputusan user) — `applyDebtTransaction` (transfer flow Worker, `POST /transactions` + `debtAction`) TIDAK disentuh, masih percaya `debtAction` mentah dari client tanpa validasi `direction`. Lihat TODO di atas.
- **Belum dikomit.**

## Riwayat implementasi (MCP — `create_debt_direct`)

Dikerjakan 2026-10-17, sesi lanjutan setelah port Worker:

- `create-debt-direct.ts` — deskripsi tool & field `type`/`accountId` (Zod `.describe()`) diperbarui eksplisit menyebut constraint arah: `accountId` harus akun yang arahnya sama dengan `type`, akan ditolak kalau beda. Tool ini SELALU melahirkan baru (tidak ada cabang pelunasan) — deskripsi diperbaiki arahkan ke `pay_debt_non_cash` (pelunasan tanpa uang) atau `create_transaction` type=transfer (pelunasan lewat kas) untuk kasus pelunasan, bukan tool ini.
- Dikonfirmasi `workerFetch` (`lib/worker-client.ts`) SUDAH meneruskan `body.error` dari Worker apa adanya sebagai `WorkerRequestError.message`, dan TIDAK ADA satu pun tool MCP yang menangani error ini secara eksplisit (dibiarkan propagate, ditangkap SDK `@modelcontextprotocol/server` sebagai tool error response standar) — pesan reject validasi `direction` dari Worker otomatis sampai ke LLM pemanggil tanpa perubahan kode tambahan.
- **Scope meluas, disetujui eksplisit oleh user**: ditemukan `debt_accounts.direction` TIDAK ADA SAMA SEKALI di snapshot sync MCP (`GET /sync`, dikonsumsi `fetchFullSnapshot`) — berarti klaim awal "LLM bisa cek direction dulu lewat get_account_balances" di deskripsi tool itu SALAH sampai ditambahkan:
  - Worker: `sync/service/entities/debt-accounts.ts` baru (`fetchDebtAccounts`, pola identik `fetchInvestmentAccounts`), didaftarkan di `sync/service/index.ts` (`SyncResponse.debtAccounts`, query paralel `Promise.all`).
  - MCP: `DebtAccount` type baru di `sync-snapshot/types.ts` + `SyncSnapshot.debtAccounts`, diekspor dari `entities/index.ts`.
  - `get-account-balances.ts` — hasil tiap akun sekarang menyertakan `debtDirection: "receivable" | "payable" | undefined` (`undefined` untuk akun bukan `debt`, `null` untuk akun `debt` yang belum diset arahnya) dari lookup `snapshot.debtAccounts`. Deskripsi tool diperbarui menyebut field ini eksplisit.
- Diverifikasi `npm run typecheck` bersih di kedua app (`apps/worker`, `apps/mcp-server`). **Tidak ada test runner di `apps/mcp-server`** juga (sama seperti Worker) — diverifikasi manual end-to-end via `wrangler dev --local` + `curl`: `GET /sync` mengembalikan `debtAccounts` berisi `{accountId, direction, updatedAt, deletedAt}` sesuai data yang di-seed; re-konfirmasi `POST /debts` mismatch → reject, match → sukses (setelah semua perubahan MCP+Worker digabung, bukan cuma Worker sendirian). Data uji dibersihkan dari D1 lokal setelah verifikasi.
- **Belum dikomit.**

## Riwayat implementasi (Worker transfer flow — `applyDebtTransaction`)

Dikerjakan 2026-10-17, sesi lanjutan setelah verifikasi MCP — user menyetujui memperluas scope yang awalnya ditunda ("Scope Worker yang SENGAJA belum disentuh").

**Masalah sebelum rewrite**: `applyDebtTransaction` (`debts/service.ts`) punya 2 cabang — `cash-debt` SELALU hardcode `receivable` (bug nyata sama persis desktop versi lama, bukan cuma gap validasi), `debt-cash` butuh `debtAction` eksplisit (`'payable'`/`'settlement'`) dikirim client tanpa validasi apa pun terhadap arah akun sebenarnya.

- Fungsi baru `resolveDebtTransactionOutcome` (`debts/service.ts`) — murni baca (tidak menulis), return union `{kind: 'noop'} | {kind: 'create', type, debtAccountId} | {kind: 'settle', debtAccountId} | {kind: 'direction_missing', debtAccountId}`. Logic derivasi SAMA persis tabel Jalur 1 desktop (`cash-debt`+`receivable`→create, `cash-debt`+`payable`→settle, `debt-cash`+`payable`→create, `debt-cash`+`receivable`→settle). `debtAccountId` disertakan di hasil supaya caller tidak perlu query ulang `getAccountType`.
- `applyDebtTransaction` ditulis ulang total memakai fungsi di atas — parameter `debtAction` **dihapus** dari `ApplyDebtTransactionInput` (type internal, bukan payload API).
- **Precheck atomicity di `transactions/service.ts` ikut direvisi** (bagian paling berisiko dari perluasan scope ini): precheck `validateDebtSettlementAmount` (cegah transaksi tersimpan sementara FIFO-nya ditolak, harus terjadi SEBELUM insert/update baris `transactions`) sebelumnya dipicu kondisi `payload.debtAction === 'settlement'` — diganti jadi memanggil `resolveDebtTransactionOutcome` lebih dulu (query baca `direction`, TANPA menulis), baru precheck settlement kalau hasilnya `kind: 'settle'`. Dilakukan di KEDUA jalur (`createTransactionRow` baris ~177, `updateTransactionRow` baris ~446) — di update-path, hasil `resolveDebtTransactionOutcome` di-reuse juga untuk precheck self-settlement (sebelumnya precheck terpisah dengan kondisi `debtAction` yang sama).
- `applyDebtEditAction` (edit-path) **tidak perlu disentuh langsung** — sudah mendelegasikan ke `applyDebtTransaction` untuk cabang create/recreate, jadi perbaikan otomatis berlaku di edit-path juga (pola sama seperti desktop `applyDebtTransactionEdit`→`applyDebtTransaction`).
- `debtAction` **dihapus** dari call-site `applyDebtTransaction`/`applyDebtEditAction` di `transactions/service.ts` (2 tempat), dan dari skema tool MCP `create_transaction` (`transactionFields.debtAction` dihapus, deskripsi field `settleDebtIds` + deskripsi tool diperbarui menjelaskan arah otomatis).
- `debtAction` **TETAP ada** di `PushTransactionPayload`/`PatchTransactionPayload` (`transactions/schema.ts`) — field ini dipertahankan demi kompatibilitas bentuk payload (desktop `push-transaction.ts` masih punya tipe ini di kontraknya), tapi dikonfirmasi dead baik di sisi Worker (tidak pernah dibaca lagi) maupun desktop (tidak pernah diisi, dikonfirmasi sesi sebelumnya). Komentar diperbarui menjelaskan status dead field ini eksplisit.
- Diverifikasi `npm run typecheck` bersih (`apps/worker`, `apps/mcp-server`). **Diverifikasi manual `wrangler dev --local`** (instance dijalankan user sendiri, bukan oleh agent) — 7 skenario via `POST /transactions` + query D1 langsung (bukan cuma percaya status "ok"):
  1. `cash→payable`, `settleDebtIds` kosong → tidak ada `debts`/`debt_payments` baru (no-op aman, BUKAN salah hardcode jadi piutang).
  2. `cash→receivable` → `debts.type='receivable'` lahir baru, benar.
  3. `payable→cash` → `debts.type='payable'` lahir baru (sebelumnya butuh `debtAction='payable'` manual, sekarang otomatis).
  4. `receivable→cash`, `settleDebtIds` kosong → no-op aman.
  5. `cash→payable` dengan `settleDebtIds` berisi utang dari skenario 3 → FIFO settle benar, `debts.status='paid'`, `debt_payments.transaction_id` tercatat tepat.
  6. Nominal settle melebihi sisa → reject dengan pesan jelas, **dan dikonfirmasi `COUNT(*) FROM transactions WHERE id=...` = 0** — atomicity precheck-sebelum-insert terjaga, bukan transaksi tersimpan dengan FIFO gagal.
  7. Akun debt tanpa `debt_accounts` sama sekali → reject dengan pesan jelas.
  Data uji dibersihkan dari D1 lokal setelah verifikasi.
- **Belum dikomit.**

## Latar belakang

Ditemukan lewat dogfooding manual jalur Utang Piutang — detail reproduksi lengkap (root cause, selisih saldo nyata +Rp20.000) ada di [docs/dogfooding/2026-10-16-form-utang-piutang-dropdown-akun-debt-tidak-difilter-per-jenis.md](../../../../docs/dogfooding/2026-10-16-form-utang-piutang-dropdown-akun-debt-tidak-difilter-per-jenis.md).

Ringkas: form "Tambah Utang/Piutang" (`new-debt-form.tsx`) menampilkan SEMUA akun `account_type='debt'` di dropdown "Akun Utang Piutang" tanpa membedakan apakah akun itu untuk piutang atau utang, dan auto-prefill mengambil akun debt pertama tanpa pertimbangan `debt_type` yang sedang dipilih. Akibatnya entri **Utang** bisa (dan memang) tersimpan dengan akun yang secara nama untuk **Piutang** — saldo kas jadi salah arah saat pelunasan (naik, bukan turun), tanpa error apa pun.

**Ini bukan kasus baru.** Agent riset menemukan insiden identik sudah pernah terjadi di data produksi: migrasi `0033_backfill_direct_debt_transactions.sql` kategori D — debt `type='payable'` bernama "Piutang Retailku" ternyata `account_id` menunjuk akun "Piutang", dikonfirmasi user sendiri sebagai "SALAH INPUT sejak awal", ditambal manual waktu itu. Pola yang sama muncul lagi sekarang — tanda bahwa tambal-sulam di level data tidak cukup, perlu perbaikan struktural.

### Kenapa bukan sekadar bug kode form

Root cause sebenarnya: skema `accounts` tidak punya cara eksplisit membedakan akun debt untuk piutang vs utang — pembedaan murni dari nama akun yang dibaca manusia ("Piutang", "Utang Dagang"). `classifyAccountPair` (`shared/debts/classify-account-pair.ts`) juga murni berbasis `account_type` mentah, tidak pernah melihat identitas akun debt — arah `receivable`/`payable` ditentukan semata dari arah transfer (`account_id` vs `transfer_account_id`), bukan dari akun debt mana yang dipakai. Jadi akun debt di `applyDebtTransaction` hanya berfungsi sebagai "tempat parkir" `account_id` di baris `debts`, bukan pembeda jenis.

(Desain "satu akun debt boleh dipakai 2 arah" yang disebut di `docs/concept/konsep-tipe-akun.md` versi lama — sudah DIBATALKAN, lihat "Perubahan besar dari rencana awal" poin 1.)

### Percobaan pertama yang dibuang

Sempat dicoba pendekatan "warning UI non-blocking" (tanpa ubah skema) — dropdown & prefill dibuat "cerdas" berdasarkan histori pemakaian tiap akun (`COUNT` per `account_id` + `debts.type`), dengan warning kalau akun yang dipilih historinya dominan berlawanan arah. Implementasi awal langsung kena bug logic `useEffect` prefill (re-render tidak konsisten, prefill tidak jalan saat toggle `debt_type`), dan setelah didiskusikan ulang disadari pendekatan ini secara fundamental rapuh — heuristik berbasis histori tidak bisa menjamin apa pun untuk akun baru/jarang dipakai, dan tetap bisa diabaikan user. Diputuskan naik ke pendekatan skema (dokumen ini), mengikuti pola `investment_accounts` yang sudah terbukti di proyek ini untuk kasus serupa (lihat [account-type-investment.md](account-type-investment.md)).

### Worker + MCP juga kena gap yang sama

Dicek eksplisit (bukan diasumsikan) — `apps/worker` punya replika PENUH modul debts (`apps/worker/src/modules/debts/`, termasuk `classify-account-pair.ts` sendiri, pola port yang sama persis dengan investasi, lihat `account-type-investment.md` bagian "Port ke Worker + MCP"). Fungsi `createDirectDebt` (`apps/worker/src/modules/debts/service.ts:543-565`) — dipanggil LANGSUNG dari tool MCP `create_debt_direct` (`apps/mcp-server/src/lib/mcp-tools/debts/create-debt-direct.ts`), BUKAN lewat desktop sama sekali — cuma memvalidasi `accountType === 'debt'`, sama rentan seperti bug yang ditemukan di desktop. **Status: masih belum diperbaiki (lihat TODO).**

**Risikonya lebih tinggi di jalur ini**: yang memilih `accountId` untuk `create_debt_direct` adalah model LLM yang menebak dari daftar akun berdasarkan deskripsi tool (`"Akun bertipe 'debt'"`, tidak menyebut arah sama sekali) — bukan manusia yang melihat UI dengan dropdown terfilter. Tanpa validasi backend, kombinasi `type: 'payable'` + `accountId` akun "Piutang" bisa lolos tanpa penolakan apa pun lewat MCP, bahkan setelah desktop diperbaiki — karena desktop dan Worker adalah dua implementasi terpisah yang harus diperbaiki MASING-MASING (tidak ada kode bersama antara keduanya, cuma pola yang sama).

Konsekuensinya: validasi `direction` vs `type` WAJIB ditambahkan di `createDirectDebt` (Worker), bukan cuma di `applyDebtTransaction` (desktop) — ini bukan "nice to have", karena jalur MCP sama sekali tidak terlindungi oleh perbaikan UI desktop manapun.

## Rencana pendekatan (versi awal — dipertahankan sebagai catatan sejarah)

> Catatan: bagian ini ditulis SEBELUM bug kedua ditemukan dan sebelum keputusan menghapus `'both'`. Beberapa detail di bawah (skema `direction` dengan `'both'`, validasi digambarkan "opsional") sudah DIGANTIKAN oleh "Perubahan besar dari rencana awal" di atas — dipertahankan di sini hanya untuk konteks kenapa pendekatan tabel detail (bukan kolom langsung) dipilih sejak awal.

Pola identik `investment_accounts` (migrasi `0036_investment_accounts_and_purchases.sql`) — tabel detail 1:1, BUKAN kolom baru langsung di `accounts` (yang tetap generik lintas tipe).

```sql
CREATE TABLE debt_accounts (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('receivable', 'payable', 'both'))
);
```

- `receivable` — akun ini HANYA untuk piutang (mis. "Piutang", "Piutang Dagang").
- `payable` — akun ini HANYA untuk utang (mis. "Utang Dagang").
- `both` — akun netral, boleh dua arah (mis. "Keluarga", "Orang Lain", "Bisnis" — sesuai histori pemakaian riil mereka saat ini, lihat query di bawah). **(Dihapus di migrasi 0051 — lihat "Perubahan besar dari rencana awal".)**

Tabel baru, tidak direferensikan FK tabel lain — `ALTER TABLE`/`CREATE TABLE` biasa, TIDAK perlu teknik copy-and-rename (`docs/rules/sqlite-copy-and-rename-migration.md`).

### Backfill data existing

Histori pemakaian riil tiap akun debt (dicek lewat `finance.dev.db`, `docs/rules/checking-dev-database.md`, saat dogfooding 2026-10-16):

| Akun | receivable | payable | `direction` backfill |
|---|---|---|---|
| Piutang | 22 | 2 (SALAH, akan dibersihkan manual oleh user) | `receivable` |
| Piutang Dagang | 2 | 0 | `receivable` |
| Utang Dagang | 0 | 2 | `payable` |
| Keluarga | 2 | 0 | `both` (nama netral, histori kebetulan baru 1 arah) |
| Orang Lain | 3 | 0 | `both` (nama netral) |
| Bisnis | 0 | 0 | `both` (belum ada histori sama sekali, nama netral) |

Backfill ini dijalankan SEKALI sebagai bagian migrasi data (bukan jadi logic heuristik runtime seperti percobaan pertama yang dibuang) — akun baru yang dibuat user SETELAH migrasi ini wajib eksplisit isi `direction` lewat form "Tambah Akun", tidak ada default tebakan.

### Form "Tambah Akun"

`features/accounts/contents/detail/form/add-edit/` — field "Arah" (toggle/select 3 opsi: Piutang saja / Utang saja / Keduanya) muncul kondisional saat `account_type === 'debt'`, pola sama persis field `unit_label`+`current_market_value` yang muncul kondisional saat `account_type === 'investment'` (`field-account-type.tsx`, `use-create-account.ts` insert ke tabel detail setelah insert `accounts`, `use-update-account.ts` upsert manual).

### `new-debt-form.tsx`

Buang total pendekatan histori/prefill-cerdas dari percobaan pertama. Dropdown "Akun Utang Piutang" di-filter LANGSUNG dari `direction`:

```ts
const debtAccounts = accounts?.filter(
  (account) =>
    account.account_type === "debt" &&
    account.is_active &&
    (account.debt_direction === debtType || account.debt_direction === "both")
);
```

Tidak ada lagi prefill naif atau warning rapuh — kalau cuma ada 1 opsi yang cocok, auto-select itu (bukan "akun pertama apa pun"); kalau tidak ada akun yang cocok sama sekali untuk `debt_type` yang dipilih, tampilkan pesan eksplisit ("Belum ada akun Utang — buat dulu lewat Tambah Akun") daripada dropdown kosong tanpa penjelasan.

### `applyDebtTransaction` — defense-in-depth (opsional, didiskusikan saat implementasi)

Tambah validasi di `apply-debt-transaction/create.ts`: kalau akun debt yang dipakai (`transferAccountId` untuk `cash-debt`, `accountId` untuk `debt-cash`) punya `direction` yang eksplisit bertentangan dengan arah yang diminta (`receivable` dipakai padahal `direction='payable'`, atau sebaliknya), throw error baru (pola sama `UnsupportedAccountPairError`/`DebtSelfSettlementError`) — mencegah kasus ini terulang lewat jalur form transaksi utama (`field-transfer-account-or-category.tsx`) juga, bukan cuma `new-debt-form.tsx`. `direction='both'` selalu lolos tanpa validasi tambahan.

### Smoke test manual (checklist, dijalankan saat implementasi selesai)

**Desktop (`tauri dev`)**

1. Buat akun debt baru lewat "Tambah Akun" dengan `direction='payable'` — field "Arah" tersimpan benar, cek `finance.dev.db` (`debt_accounts` punya baris, `direction` sesuai).
2. Dari "Tambah Utang/Piutang", pilih jenis Utang — dropdown "Akun Utang Piutang" HANYA tampilkan akun `payable`/`both`, akun `receivable`-only ("Piutang") tidak muncul sama sekali.
3. Toggle ke Piutang — dropdown berganti ke akun `receivable`/`both`.
4. Buat entri Utang baru, lunasi dari halaman Utang — saldo kas yang dipakai HARUS turun sebesar nominal pelunasan (bukan naik seperti bug awal), diverifikasi query `finance.dev.db` dengan query yang sama persis dengan `useAccountBalances`.
5. Coba kirim payload lewat jalur form transaksi utama (`field-transfer-account-or-category.tsx`, bukan `new-debt-form.tsx`) dengan kombinasi akun yang bertentangan arah — harus ditolak `applyDebtTransaction` dengan pesan jelas, bukan silent-insert salah kategori.
6. `tsc --noEmit` bersih, test vitest existing (`apply-debt-transaction.test.ts` dkk) tetap lulus + test baru untuk validasi direction.

**Worker (`wrangler dev` lokal, BUKAN production — lihat [docs/rules/checking-dev-database.md](../../../../docs/rules/checking-dev-database.md) soal isolasi dev/prod)**

7. Migrasi D1 lokal jalan bersih, `direction` ter-backfill benar untuk akun debt existing (cek `wrangler d1 execute <db> --local`).
8. `POST /debts` (dipanggil `create_debt_direct`) dengan `type: 'payable'` + `accountId` akun yang `direction='receivable'` — expect `422`/rejected dengan pesan jelas, BUKAN insert sukses.
9. Payload yang kombinasinya valid (`type` cocok `direction`, atau akun `direction='both'`) — expect sukses seperti biasa, tidak ada regresi ke jalur yang sudah benar.
10. Jalur `create_transaction` + `debtAction` (transfer kas↔debt biasa, bukan direct) — pastikan `applyDebtTransaction` versi Worker (`classify-account-pair.ts` + service) ikut tervalidasi juga, bukan cuma `createDirectDebt`.

**MCP**

11. Tool `create_debt_direct` — deskripsi tool diperbarui menyebut constraint arah akun; coba panggil dengan kombinasi yang sengaja bertentangan, verifikasi pesan rejected dari Worker diteruskan apa adanya ke response tool (bukan error generik).
12. `get_debt_summary`/tool list lain yang menampilkan akun debt ke LLM — cek apakah perlu menyertakan `direction` di response supaya model bisa memilih akun yang tepat SEBELUM memanggil `create_debt_direct` (mengurangi percobaan gagal), bukan cuma mengandalkan validasi reject setelahnya.

**Cakupan desktop vs Worker/MCP — WAJIB keduanya**, bukan pilih salah satu: gap yang sama ada di dua implementasi terpisah (lihat "Worker + MCP juga kena gap yang sama" di atas), memperbaiki satu tidak melindungi yang lain.
