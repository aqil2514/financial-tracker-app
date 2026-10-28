
# Porting Akun Tipe Debt / Utang-Piutang (Desktop → Mobile)

Dokumen anak dari [porting-account.md](porting-account.md) — fokus khusus tipe `debt`. Baca induknya dulu untuk konteks kenapa porting akun dipecah per tipe, dan baca [porting-account-cash.md](../done/porting-account-cash.md) sebagai referensi pola yang sudah terbukti bagus (CRUD akun, saldo on-the-fly, picker, dst — tipe `debt` WARIS semua itu, dokumen ini cuma menambahkan apa yang KHUSUS untuk `debt`).

**Wajib baca sebelum implementasi**: [konsep-tipe-akun.md](../../../../../docs/concept/konsep-tipe-akun.md) dan [konsep-utang-piutang.md](../../../../../docs/concept/konsep-utang-piutang.md).

## Status & TODO saat ini (ringkas)

Belum ada implementasi — dokumen ini baru hasil riset, menunggu diskusi/approval sebelum mulai kerja.

- [ ] Skema database mobile: tabel `debt_accounts`, `debts`, `debt_payments`, `contacts`. Lihat bagian Skema.
- [ ] CRUD Kontak (list, create, edit, delete) — form sederhana (`name` + `note` plain text, BUKAN rich text TipTap seperti desktop).
- [ ] Field `direction` di `AccountForm` mobile — toggle Piutang/Payable, cuma muncul saat `kind === "account" && account_type === "debt"`, wajib diisi, upsert ke `debt_accounts`.
- [ ] Logic `applyDebtTransaction` (Jalur 1 — transfer kas↔debt) dan `applyDirectDebtTransaction` (Jalur 2 — income/expense langsung di akun debt) — port dari `apps/desktop/src/shared/debts/`.
- [ ] Alokasi FIFO pelunasan (`settleDebtsFifo`) + fragment SQL `remaining` tunggal (hindari duplikasi/drift seperti yang pernah kejadian di desktop).
- [ ] UI form transaksi: field kontak (combobox + create-inline), field pilih debts ongoing untuk pelunasan (`FieldDebtAction` ala desktop), locking field saat `debtFieldsLocked`.
- [ ] Guard edit/delete transaksi terkait debt (`role: principal/payment/none`) — port dari `apply-debt-transaction/edit.ts` dan `delete.ts`.
- [ ] Saldo akun debt ikut rumus on-the-fly yang sudah ada di mobile (tidak perlu kolom baru, akun debt sudah otomatis ikut dihitung lewat `transactions.account_id`/`transfer_account_id` yang sudah ada).
- [ ] Balance Correction akun debt: **DILARANG**, bukan diimplementasikan — tampilkan pesan penolakan seperti desktop, bukan form.
- [ ] Halaman/summary debt (list per kontak, atau minimal list flat payable/receivable) — scope MVP masih perlu diputuskan, lihat bagian Keputusan Terbuka.
- [ ] `debt_amount_adjustments` + `correctDebtRemaining` (koreksi granular per-debt) — **kandidat di luar MVP**, lihat Keputusan Terbuka.

## Riset: implementasi debt di desktop

### Skema final (hasil gabungan semua migrasi desktop)

Empat tabel. Referensi desktop: `apps/desktop/docs/tables/debt.md`, `apps/desktop/docs/tables/contact.md`, migrasi `0012`→`0053`.

```sql
CREATE TABLE debt_accounts (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('receivable', 'payable'))
);

CREATE TABLE contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
CREATE INDEX idx_contacts_name ON contacts(name);

CREATE TABLE debts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('receivable', 'payable')),
    contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
    amount REAL NOT NULL,
    account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'paid', 'written_off')),
    note TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'retailku_sync')),
    source_ref TEXT,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
CREATE INDEX idx_debts_contact_id ON debts(contact_id);
CREATE UNIQUE INDEX idx_debts_source_ref ON debts(source, source_ref) WHERE source_ref IS NOT NULL;
CREATE INDEX idx_debts_status ON debts(status);

CREATE TABLE debt_payments (
    id TEXT PRIMARY KEY,
    debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    note TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'retailku_sync')),
    source_ref TEXT,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
CREATE INDEX idx_debt_payments_debt ON debt_payments(debt_id);
CREATE UNIQUE INDEX idx_debt_payments_source_ref ON debt_payments(source, source_ref) WHERE source_ref IS NOT NULL;
```

Catatan kunci:
- Tidak ada kolom `direction` di `accounts` itu sendiri — disimpan di tabel ekstensi 1:1 `debt_accounts` (PK = FK ke `accounts.id`).
- `direction` TIDAK PERNAH punya opsi `'both'` di versi final — opsi itu pernah ada sesaat lalu sengaja dihapus (migrasi `0051`), konsisten dengan konsep: satu akun = satu arah murni.
- `remaining` (sisa belum lunas) **tidak disimpan** sebagai kolom — selalu dihitung `amount - SUM(debt_payments.amount yang belum di-soft-delete)`. Desktop sempat salah hitung karena fragment SQL ini di-duplikasi manual di banyak tempat (soft-deleted payment masih ikut terhitung) — **wajib dibuat SATU fungsi/konstanta SQL di mobile**, jangan diduplikasi.
- FK dari `debts`/`debt_payments` ke `transactions` adalah `ON DELETE SET NULL`, bukan CASCADE — hapus transaksi tidak menghapus riwayat debt (lihat bagian Guard di bawah, ini bukan detail teknis kebetulan, tapi konsekuensi langsung dari aturan konsep "nominal piutang/utang tidak boleh hilang gara-gara transaksi dihapus").
- `debts.account_id`/`debt_payments.account_id` nullable di desktop khusus untuk baris dari `source='retailku_sync'` (integrasi Warung Aqil, tidak relevan untuk mobile) — mobile tetap boleh replikasi kolomnya nullable (konsisten skema), tapi jalur kode mobile sendiri selalu akan mengisinya (`source` akan selalu `'manual'`, tidak ada konsep sync Retailku di mobile).

### Kompatibilitas lintas-device (PK & kolom sync)

Semua empat tabel di atas pakai **`id`/`account_id` bertipe `TEXT` (UUID)**, bukan `INTEGER AUTOINCREMENT` — ini sudah pola yang dipakai mobile sejak `accounts`/`account_groups` (`0005_accounts.ts`), jadi tidak ada penyesuaian baru yang dibutuhkan di sisi ID: tetap generate UUID di mobile sama seperti akun/kategori/transaksi yang sudah ada, supaya ID yang lahir di mobile tidak akan pernah bentrok dengan ID yang lahir di desktop/worker kalau suatu saat disinkronkan.

Soal kolom `updated_at`/`deleted_at`/`sync_source` (infrastruktur cloud-sync desktop↔worker): mengikuti keputusan yang SUDAH diambil untuk `accounts` di porting cash (`deleted_at`/`sync_source` **skip** untuk porting lokal, ditunda sampai semua tipe akun selesai dan dibahas ulang sebagai putaran kerja terpisah — lihat [porting-account-cash.md](../done/porting-account-cash.md) Keputusan #2/#3). Tidak ada alasan untuk berlaku beda di sini — keempat tabel baru ini (`debt_accounts`, `contacts`, `debts`, `debt_payments`) **juga skip** ketiga kolom itu untuk fase ini. Ini TIDAK mengurangi kompatibilitas lintas-device: begitu putaran sync digarap nanti, menambah kolom nullable baru lewat migrasi (pola sama seperti `0006_transaction_cash_neutral.ts`) tidak mengubah/merusak data yang sudah ada, dan `id` yang sudah UUID sejak awal tidak perlu dimigrasikan ulang. `source`/`source_ref` (integrasi Retailku) juga skip total — tidak relevan untuk mobile sama sekali.

**Konsekuensi konkret**: skema mobile untuk keempat tabel = skema final desktop di atas **minus** `updated_at`, `deleted_at`, `sync_source`, `source`, `source_ref`. Index `idx_debts_source_ref`/`idx_debt_payments_source_ref` ikut tidak dibuat (tidak ada kolomnya). Index lain (`idx_contacts_name`, `idx_debts_contact_id`, `idx_debts_status`, `idx_debt_payments_debt`) tetap diport.

### Dua jalur pembuatan/perubahan `debts` (logic `applyDebtTransaction`)

Referensi: `apps/desktop/src/shared/debts/apply-debt-transaction/` (`create.ts`, `edit.ts`, `delete.ts`), `apply-direct-debt-transaction.ts`.

**Jalur 1 — transfer kas↔debt** (`applyDebtTransaction`, hanya aktif untuk `type === 'transfer'`):
- `classifyAccountPair()` menentukan kombinasi akun sumber/tujuan. Relevan debt: `cash-debt`, `debt-cash` (lahir/lunas, arah dibaca dari `direction` akun debt), `debt-debt` (no-op, transfer antar dua akun debt tidak melahirkan/melunasi apa pun).
- `cash→debt` dengan `direction='receivable'` → `createDebt()` baru. `direction='payable'` → `settleDebtsFifo()`.
- `debt→cash` logic simetris dibalik.
- Akun debt yang belum punya baris `debt_accounts` (direction belum diisi) → harus ditolak (`DebtAccountDirectionMissingError` di desktop) — konsisten dengan field `direction` wajib di form.

**Jalur 2 — income/expense langsung di akun debt** (`applyDirectDebtTransaction`, tanpa kas berpindah):
```
createsNewDebt = (direction === "payable" && type === "expense") || (direction === "receivable" && type === "income")
```
Jika `createsNewDebt` → `createDebt()` baru. Selain itu → `settleDebtsFifo()`. Tabel kombinasi lengkap sudah ada di konsep-utang-piutang.md bagian "Jalur 2".

**Alokasi FIFO** (`settleDebtsFifo`):
- Hanya memproses `debtIds` yang di-passing eksplisit dari UI (user pilih sendiri debts mana yang mau dilunasi — bukan auto-pilih semua ongoing kontak itu).
- Urut `ORDER BY date ASC, id ASC` (FIFO berdasar tanggal LAHIR piutang, bukan tanggal bayar).
- Iterasi: alokasikan `min(debt.remaining, sisaDibayarkan)` per debt, **satu baris `debt_payments` per debt yang kebagian alokasi** (jadi satu transaksi pelunasan bisa melahirkan beberapa `debt_payments`, semua menunjuk `transaction_id` yang sama), kurangi sisa, lanjut sampai habis.
- Status `ongoing→paid` ditentukan per-baris saat alokasi: kalau `allocation >= debt.remaining` saat itu → `UPDATE debts SET status='paid'`. Bukan trigger/computed column, murni logic kode di titik ini.
- Kalau `remaining` yang dibayarkan melebihi total `remaining` debts yang dipilih — desktop menolak di level validasi UI (`validateDebtFields` di `use-transaction-debt-fields.ts`), bukan di level `settleDebtsFifo` itu sendiri.
- Kalau TIDAK ada debts ongoing sama sekali yang bisa dikurangi (khusus Jalur 2, mis. income di akun payable padahal belum ada utang tercatat) → transaksi **ditolak** (sesuai konsep).

### Deteksi peran transaksi terhadap debt

Perlu satu fungsi query yang dipakai berulang (desktop: `use-transaction-debt-status.ts`, `getTransactionDebtStatus`): untuk sebuah `transactionId`, kembalikan salah satu dari:
- `{role: 'none'}` — transaksi ini tidak terkait debt sama sekali.
- `{role: 'principal', debtId, hasPayments}` — transaksi ini adalah pokok/awal lahirnya sebuah debt (`debts.transaction_id = id`). `hasPayments` dicek dari ada/tidaknya baris `debt_payments` untuk `debtId` itu.
- `{role: 'payment', debtPaymentId, debtId}` — transaksi ini adalah satu cicilan/pelunasan (`debt_payments.transaction_id = id`).

Dipakai sebagai basis guard edit/delete di bawah.

### Guard edit transaksi terkait debt

Referensi: `apply-debt-transaction/edit.ts` — fungsi `applyDebtTransactionEdit()` (dan versi Jalur 2 di `apply-direct-debt-transaction-edit.ts`, logic identik).

- `role: 'none'` → treat sebagai create baru (`applyDebtTransaction`).
- `role: 'principal'`:
  - Field "berbahaya" (nominal, akun, kontak) **tidak berubah** → cukup update `debts.date`, selalu aman.
  - Field berbahaya **berubah DAN** `hasPayments === true` → **ditolak** (pesan: piutang/utang ini sudah menerima cicilan dari transaksi lain, tidak bisa diubah dari sini — selesaikan dulu baru bisa ubah pokok). Ini implementasi literal aturan di konsep-utang-piutang.md bagian "Saat mengedit transaksi".
  - Lolos guard → hapus baris `debts` lama, buat ulang dari awal (`applyDebtTransaction` lagi) — bukan UPDATE in-place.
  - Guard tambahan: kalau user memilih `settleDebtIds` yang menyertakan debt miliknya sendiri → ditolak (mencegah debt melunasi dirinya sendiri; idealnya UI sudah mencegah ini duluan lewat exclude di query ongoing debts, guard ini jaring pengaman kedua).
- `role: 'payment'`:
  - Field tidak berbahaya → update `debt_payments.date` saja.
  - Field berbahaya → hapus baris `debt_payments` itu, **downgrade status** `debts.status` dari `'paid'` balik ke `'ongoing'` kalau ternyata setelah payment ini dihapus jadi belum lunas lagi (`amount > SUM(sisa debt_payments)`), lalu proses ulang sebagai pelunasan baru.

### Guard delete transaksi terkait debt

Referensi: `apply-debt-transaction/delete.ts` — fungsi `detachDebtForDeletedTransaction()`.

- `role: 'payment'` → hapus baris `debt_payments`, downgrade status `paid→ongoing` kalau perlu (logic sama seperti di atas). Transaksinya sendiri dihapus oleh caller (use-case delete transaction umum), fungsi ini cuma membersihkan sisi debt.
- `role: 'principal'` → **TIDAK menghapus baris `debts`** — hanya `UPDATE debts SET transaction_id = NULL`. Nominal dan status debt tetap sama persis seperti sebelum penghapusan, cuma kehilangan tautan ke "lahir dari transaksi mana". Konsisten dengan aturan konsep: nominal piutang/utang tidak boleh hilang gara-gara transaksi pokoknya dihapus.

Setelah delete selesai, tampilkan pesan singkat kalau transaksi yang dihapus memang terkait debt (sesuai konsep: tidak menginterupsi dengan konfirmasi SEBELUM hapus, cukup info SETELAH).

## CRUD Kontak (referensi desktop)

- **Field**: hanya `name` (wajib) + `note` (opsional). **Beda penting untuk mobile**: desktop menyimpan `note` sebagai rich text TipTap (`JSON.stringify` JSONContent) — ini TIDAK perlu diikuti, mobile belum punya editor rich text di tempat lain manapun. `note` di mobile cukup `TEXT` plain, field multiline biasa (`FormFieldText` dengan `multiline`, pola yang sudah ada).
- **Create/Update**: INSERT/UPDATE biasa, tidak ada logic istimewa.
- **Delete**: **hard DELETE**, **TIDAK dicegah** walau masih ada `debts`/`debt_payments` yang merujuk kontak itu — aman karena FK `debts.contact_id` adalah `ON DELETE SET NULL`. Tampilkan peringatan teks saat konfirmasi delete (pola `Alert.alert`): riwayat piutang/utang terkait TIDAK ikut terhapus, cuma kehilangan tautan nama kontaknya.
- **List**: pencarian by nama, client-side, tidak perlu pagination di awal (jumlah kontak biasanya kecil).
- **Create-inline dari form transaksi**: combobox nama kontak dengan opsi "Buat kontak baru: ..." — pola get-or-create by nama (desktop: `resolveContactId()`), bukan dialog form penuh terpisah. Konsisten dengan pola create-inline akun yang sudah ada di picker akun (tapi lebih sederhana — kontak cuma butuh nama, tidak perlu form penuh seperti `AccountForm`).
- **Di luar MVP**: fuzzy-match warning untuk nama kontak yang mirip tapi beda ejaan (desktop: `findSimilarContacts`) — nice-to-have, bukan blocker.

## Field `direction` di form Akun

- Field baru di `AccountForm` mobile: toggle group `direction` dengan 2 opsi (`receivable` = "Piutang", `payable` = "Utang") — **tidak ada opsi ketiga**, konsisten final state desktop (opsi `'both'` sempat ada lalu dihapus).
- Hanya muncul saat `kind === "account" && account_type === "debt"` (pola sama seperti `icon`/`color`/`group_id` yang cuma muncul untuk `kind === "account"`).
- **Wajib diisi** kalau `account_type === "debt"` — validasi di schema (`z.object` + custom refine, bukan bagian dari union karena `AccountForm` mobile sudah pakai object datar, bukan discriminated union — lihat alasan di porting-account-cash.md Keputusan #1).
- Submit: upsert ke `debt_accounts` (`INSERT ... ON CONFLICT(account_id) DO UPDATE SET direction = excluded.direction`), bukan kolom langsung di `accounts`.
- **Tipe akun terkunci begitu dipakai** — guard ini SUDAH ada secara umum dari porting cash (`isAccountInUse` cek transaksi). Perlu diperluas: akun debt "dipakai" juga kalau sudah ada baris `debts`/`debt_payments` yang merujuknya (bukan cuma `transactions`), sesuai redaksi "Mengubah tipe akun yang salah pilih di awal" di konsep-tipe-akun.md.

## UI Form Transaksi untuk akun debt

Referensi: `apps/desktop/src/features/transactions/form/add-edit/hooks/use-transaction-debt-fields.ts` dan komponen-komponen di `components/fields/`.

Field/logic yang perlu ditambahkan ke `transaction-form.tsx` mobile (sudah punya `FormFieldAccount` dari porting cash, field baru di sini melengkapi bukan mengganti):
- **Deteksi** `involvesDebtAccount` — benar kalau akun sumber atau tujuan bertipe `debt` (kecuali transfer debt↔debt, itu no-op).
- **Field kontak** (combobox + create-inline, lihat CRUD Kontak di atas) — wajib diisi kalau `involvesDebtAccount`, disabled kalau field debt lagi dikunci (lihat poin berikut) atau transfer debt↔debt.
- **Field pilih debts ongoing untuk dilunasi** (checklist multi-select, tampil cuma saat arah = pelunasan) — query `ongoing debts` milik kontak yang dipilih, filter `type` sesuai (payable/receivable), urut `date ASC, id ASC`, tampilkan tanggal + sisa per baris. Referensi: `useOngoingDebts` desktop, termasuk opsi exclude untuk mode edit (exclude debt yang sedang diedit sendiri, exclude payment dari transaksi yang sedang diedit saat hitung ulang `remaining`, exclude debt yang justru lahir dari transaksi ini sendiri untuk mencegah self-settlement).
- **Validasi submit**: nominal tidak boleh melebihi total `remaining` debts yang dipilih untuk dilunasi; minimal 1 debt dipilih kalau transaksi ini memang jalur pelunasan.
- **Field locking** (`debtFieldsLocked`) — kalau transaksi yang diedit adalah `role:'principal'` DAN `hasPayments`, kunci field nominal/akun/kontak (lihat Guard edit di atas).
- Submit create/update dipecah mengikuti jenis transaksi (income/expense/transfer) × (create/edit), memanggil `applyDebtTransaction`/`applyDirectDebtTransaction` yang sesuai — pola sama dengan desktop (`hooks/create-transaction/*/debt.ts`, `update-transaction/*/debt.ts`), disesuaikan ke struktur hook mobile yang sudah ada.

**Tidak perlu filter tipe akun di picker akun** — sudah berlaku otomatis begitu akun debt mulai ada di DB, sama seperti catatan di porting-account-cash.md (semua tipe akun muncul di `FormFieldAccount`, pembeda cuma badge tipe visual).

## Balance Correction — DILARANG untuk akun debt

Desktop punya `isAccountTypeRestrictedFromBalanceCorrection(accountType)` yang mencakup `["debt", "third_party"]` — dialog Balance Correction untuk akun bertipe ini **tidak menampilkan form sama sekali**, cuma pesan penolakan:

> "Saldo akun bertipe Utang Piutang tidak bisa dikoreksi langsung di sini -- saldo akun ini mengikuti riwayat piutang/utang yang tersimpan. Perbaiki lewat transaksi transfer atau betulkan transaksi akar penyebabnya."

**Mobile wajib replikasi larangan ini, bukan cuma skip fitur.** `CurrentBalanceField` yang sudah dibuat untuk cash (lihat porting-account-cash.md Keputusan #7) perlu guard tambahan: kalau `accountType !== "cash"` (atau eksplisit `=== "debt"`), tampilkan pesan yang sama alih-alih field, bukan diam-diam menyembunyikan field saja (penyembunyian tanpa penjelasan bisa bikin pengguna bingung kenapa fiturnya hilang khusus akun ini).

Alasan konseptual (bukan cuma copy aturan): saldo akun debt adalah agregasi dari banyak baris `debts` milik kontak-kontak berbeda — koreksi 1 angka per akun tidak tahu kontak/debt mana yang salah. Koreksi granular yang benar adalah per-baris `debts` (`correctDebtRemaining`, lihat Keputusan Terbuka — di luar MVP).

## Keputusan terbuka (perlu dibahas sebelum/selama implementasi)

- **Scope MVP halaman/summary debt — SUDAH DIPUTUSKAN**: desktop punya 3 halaman (`/debts` grid per-kontak, `/debts/payables`, `/debts/receivables` tabel flat masing-masing dengan filter/sort/period-picker/pagination penuh + action menu per-row: bayar, koreksi nominal, write-off). Mobile MVP cukup **2 halaman**:
  1. **Halaman Ringkasan** (setara `/debts` desktop) — list per-kontak (bukan grid 3-kolom ala desktop, mobile cukup list vertikal) dengan metrik ringkas (aktif/terbayar/belum dibayar) dan indikator piutang/utang tertua yang ongoing. Tanpa filter/sort kompleks dulu.
  2. **Halaman Utang Piutang** (gabungan `/debts/payables` + `/debts/receivables` desktop jadi SATU halaman) — list flat semua debt (payable & receivable dicampur, dibedakan badge/indikator arah per baris, bukan 2 halaman terpisah seperti desktop), row bisa di-expand untuk lihat riwayat cicilan. Tanpa filter/sort/period-picker/pagination penuh ala desktop di fase ini — cukup search sederhana kalau ternyata dibutuhkan saat dogfooding.
  Action per-row (bayar/pelunasan, koreksi nominal, write-off) tetap perlu ada di halaman Utang Piutang ini (koreksi nominal granular per-debt menyusul `debt_amount_adjustments`, lihat poin di bawah — bisa jadi action menu-nya baru berisi bayar+write-off dulu kalau koreksi granular belum digarap).
- **`new-debt-form.tsx`/`pay-debt-form.tsx` (shortcut dialog) vs integrasi penuh ke form transaksi**: desktop punya 2 jalur UI — form transaksi umum (dengan field debt kondisional) DAN dialog shortcut khusus ("Tambah Utang/Piutang Baru", "Bayar") dari halaman `/debts`. Perlu diputuskan apakah mobile butuh keduanya sejak awal, atau cukup satu jalur (lewat form transaksi umum) dulu — shortcut dialog bisa menyusul kalau dogfooding menunjukkan form transaksi umum kurang nyaman untuk kasus ini.
- **Mode pelunasan non-cash (barter/pemutihan tanpa akun kas)**: desktop punya mode ini di `pay-debt-form.tsx` (`non_cash`) — transaksi income/expense langsung di akun debt sebagai "penutup" tanpa kas sama sekali. Sebenarnya ini SAMA dengan Jalur 2 (income/expense langsung di akun debt) yang sudah masuk scope wajib di atas — jadi kemungkinan tidak perlu UI terpisah, cukup pastikan Jalur 2 di form transaksi umum sudah mendukung kasus ini. Perlu dikonfirmasi saat implementasi, bukan dianggap otomatis beres.
- **`debt_amount_adjustments` + `correctDebtRemaining`** (koreksi granular nominal satu debt, bisa naik atau turun) — desktop punya ini sebagai mekanisme resmi pengganti Balance Correction level-akun yang dilarang. **Kandidat di luar MVP** — tanpa ini, satu-satunya cara memperbaiki kesalahan input nominal debt di mobile adalah lewat guard edit yang sudah ada (cuma bisa diubah kalau belum pernah dicicil) atau hapus-buat-ulang manual. Cukup aman untuk MVP asal didokumentasikan sebagai keterbatasan yang disadari, bukan terlewat.
- **Write-off (`written_off`)**: wajib ada di skema (`status` sudah termasuk opsi ini) dan validasi dasar, tapi detail UI (konfirmasi, siapa yang bisa trigger) belum diriset mendalam di dokumen ini — perlu riset `use-write-off-debt.ts` desktop lebih lanjut saat mulai implementasi kalau belum cukup jelas dari deskripsi di konsep.
- **Fuzzy-match nama kontak** (`findSimilarContacts` desktop) — nice-to-have, bukan blocker MVP.

## Catatan

- Field `remaining`/sisa debt WAJIB dihitung lewat satu fungsi/fragment SQL tunggal yang dipakai ulang di semua query (list, FIFO, validasi) — desktop pernah mengalami bug nyata karena fragment ini di-duplikasi manual dan salah satu kopiannya lupa filter `debt_payments.deleted_at IS NULL`. Karena mobile skip kolom `deleted_at` untuk `debt_payments` di fase ini (lihat bagian Kompatibilitas lintas-device), fragment mobile otomatis lebih sederhana (`amount - COALESCE(SUM(debt_payments.amount), 0)`, tanpa filter soft-delete) — tapi prinsip "satu sumber kebenaran, jangan duplikasi manual" tetap berlaku penuh.
- Konsisten dengan prinsip "akun sebagai tumpuan" (konsep-tipe-akun.md) — semua baris `debts` HARUS menempel ke `account_id` yang valid di mobile (tidak ada kebutuhan `source='retailku_sync'` dengan `account_id` NULL di sini), jadi guard "akun debt wajib punya `direction`" bisa ditegakkan lebih ketat daripada desktop yang masih harus mengakomodasi data sync lama.
