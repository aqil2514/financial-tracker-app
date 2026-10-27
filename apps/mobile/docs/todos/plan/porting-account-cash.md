
# Porting Akun Tipe Cash (Desktop → Mobile)

Dokumen anak dari [porting-account.md](porting-account.md) — fokus khusus tipe `cash`. Baca induknya dulu untuk konteks kenapa porting akun dipecah per tipe.

## Status & TODO saat ini (ringkas)

Riset selesai, keputusan desain sudah diambil (lihat bagian Keputusan) — belum ada implementasi sama sekali. Penjelasan lengkap tiap poin ada di bagian-bagian di bawah.

- [ ] Baca konsep [konsep-tipe-akun.md](../../../../../docs/concept/konsep-tipe-akun.md) — wajib, lihat juga `porting-account.md`.
- [ ] Skema database `accounts` + `account_groups` untuk mobile (ikut porting awal, tanpa `deleted_at`/`sync_source`) — migrasi belum ditulis, lihat bagian Skema & Keputusan.
- [ ] Migrasi tambahan `transactions.is_cash_neutral` (untuk Balance Correction, ikut porting awal) — belum ditulis, lihat bagian Keputusan.
- [ ] Mapping nama-ikon → komponen render untuk field `icon` (RN tidak bisa reuse icon picker desktop) — belum didesain, lihat bagian Keputusan.
- [ ] CRUD akun dasar (list, create, update, delete dengan unassign/reassign, toggle aktif) — belum dimulai, lihat bagian CRUD.
- [ ] Perhitungan saldo on-the-fly (bukan kolom tersimpan) — belum ada, lihat bagian Saldo.
- [ ] UI pemilihan akun di form transaksi (`account_id`, `transfer_account_id`) + inline-create — sekarang masih `FormFieldText` free-text, lihat bagian Keputusan.
- [ ] Balance Correction (koreksi saldo) — ikut porting awal (keputusan sudah diambil), lihat bagian Keputusan untuk detail field `is_cash_neutral`.
- [ ] Cash opname — **bukan fitur `apps/desktop` financial-app** — itu fitur domain Warung Aqil (tool MCP `get_cash_opname_list`/`get_cash_opname_detail`, aplikasi retail/POS terpisah), bukan bagian dari aplikasi pribadi yang sedang di-porting. Jadi bukan sesuatu yang bisa "di-porting" dari desktop — kalau mau ada di financial-app, ini perancangan fitur baru dari nol, lihat bagian Catatan.

## Riset: bagaimana cash diperlakukan di desktop

### Skema (referensi, final per migrasi `0049`)

```sql
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    initial_balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    group_id TEXT REFERENCES account_groups(id) ON DELETE SET NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    account_type TEXT NOT NULL DEFAULT 'cash' CHECK (account_type IN ('cash', 'debt', 'investment', 'third_party')),
    color TEXT,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
CREATE INDEX idx_accounts_group ON accounts(group_id);

CREATE TABLE account_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
    -- updated_at/deleted_at/sync_source juga ada di desktop, soal cloud-sync — lihat Keputusan
);
```

**Penting — `deleted_at` ADA di skema desktop tapi TIDAK PERNAH dipakai desktop sendiri** (semua SELECT desktop tidak filter `deleted_at`, desktop tetap hard-delete). Kolom itu cuma dipakai sisi `apps/worker` untuk soft-delete saat sync cloud. Mobile belum punya sync cloud — jadi kolom ini kemungkinan besar tidak relevan untuk porting awal (lihat Keputusan).

`cash` adalah SATU-SATUNYA tipe yang tidak butuh tabel turunan apa pun — `debt`→`debt_accounts`/`debts`, `investment`→`investment_accounts`, `third_party`→`third_party_funds`, semuanya di luar scope dokumen ini.

### CRUD (referensi desktop)

- **Create**: `INSERT INTO accounts (...)` — untuk cash, tidak ada insert tambahan ke tabel lain (beda dari investment/debt yang insert juga ke tabel turunannya).
- **Edit**: `UPDATE accounts SET ...`. Ada guard: kalau `account_type` mau diubah TAPI akun sudah pernah dipakai transaksi (dicek via helper "is account in use" — `COUNT` dari `transactions`/`debts`/`debt_payments` terkait) → ditolak, tipe terkunci. Sesuai "Mengubah tipe akun yang salah pilih di awal" di konsep-tipe-akun.md.
- **Delete**: **HARD DELETE** (`DELETE FROM accounts WHERE id = ?`), walau kolom `deleted_at` ada di skema (lihat catatan di atas — desktop sendiri tidak memakainya). Sebelum delete, user **wajib** pilih dulu salah satu:
  - **Unassign** — set `account_id`/`transfer_account_id` transaksi terkait jadi `NULL`.
  - **Reassign** — pindahkan transaksi terkait ke akun lain yang dipilih.
  Dicek dulu lewat `COUNT(*) FROM transactions WHERE account_id = ? OR transfer_account_id = ?`. Pola dialognya mirip "lepas vs hapus beserta sub-kategori" yang sudah dibuat di `categories/[id]/edit.tsx` (porting Kategori) — kemungkinan bisa direplikasi langsung.
- **Toggle aktif**: bukan aksi quick-toggle generik seperti dot status di list kategori, melainkan field `is_active` biasa di form edit.

### List, summary, detail (referensi desktop)

- List akun desktop: accordion per grup (`account_groups`), grup "Tanpa Grup" selalu di akhir, tiap card tampilkan icon, nama, badge tipe, badge grup, badge nonaktif, saldo, deskripsi.
- Summary: pie chart top-5 saldo (toggle per-akun vs per-grup).
- Detail: saldo berjalan, saldo awal, deskripsi, statistik bulanan (income/expense/transfer per bulan terpilih), riwayat transaksi dengan running balance (window function `SUM() OVER (ORDER BY date, id)`), bisa edit/hapus transaksi langsung dari situ.

Ini semua **kemungkinan besar terlalu banyak untuk porting awal mobile** — list dasar (nama+saldo+badge) sudah cukup untuk MVP, summary/detail-lengkap bisa menyusul.

### Saldo — dihitung on-the-fly, BUKAN kolom tersimpan

Tidak ada kolom `balance` di `accounts`. Desktop selalu hitung lewat subquery tiap kali query:

```sql
SELECT
  accounts.*,
  (
    accounts.initial_balance
    + COALESCE((SELECT SUM(CASE
          WHEN t.type='income' THEN t.amount
          WHEN t.type='expense' THEN -t.amount
          WHEN t.type='transfer' THEN -t.amount
          ELSE 0 END)
        FROM transactions t WHERE t.account_id = accounts.id), 0)
    + COALESCE((SELECT SUM(t.amount) FROM transactions t
        WHERE t.type='transfer' AND t.transfer_account_id = accounts.id), 0)
  ) AS balance
FROM accounts
```

Rumus: `balance = initial_balance + SUM(income) - SUM(expense) - SUM(transfer keluar dari akun ini) + SUM(transfer masuk ke akun ini)`. **Ini pola yang HARUS direplikasi persis** di mobile (bukan dihitung ulang di JS) kalau mau konsisten dengan desktop/worker — dipakai ulang di banyak tempat berbeda di desktop (list, summary per grup, running balance per transaksi).

### Balance Correction (referensi desktop, terpisah dari CRUD dasar)

Fitur "Koreksi Saldo" — hitung `diff = targetBalance - currentBalance`, lalu insert **satu transaksi** income/expense **langsung** ke `transactions` (bukan lewat jalur create-transaction normal), dengan kategori otomatis "Penyesuaian Saldo", note "Koreksi saldo".

Khusus cash, ada field tambahan **"Hitung sebagai kas riil?"** (checkbox) yang menentukan kolom `transactions.is_cash_neutral`:
- Dicentang (ini memang selisih kas fisik riil) → `is_cash_neutral = 0`, ikut dihitung di laporan cashflow.
- Tidak dicentang (cuma salah catat administratif) → `is_cash_neutral = 1`, di-exclude dari laporan cashflow.

**Blocker porting**: kolom `transactions.is_cash_neutral` **belum ada di skema mobile sama sekali** (dicek, tidak ketemu di migrasi manapun) — kalau Balance Correction mau diporting penuh dengan behavior yang sama, butuh migrasi tambahan `ALTER`/copy-and-rename `transactions` lagi (pola yang sama seperti migrasi `0004_transaction_category_fk.ts` di porting Kategori). Ini alasan kenapa Balance Correction masuk daftar "belum diputuskan", bukan otomatis ikut porting awal.

### Field form (referensi desktop)

Field universal (relevan untuk cash): `name`, `initial_balance`, `icon`, `color`, `group_id`, `description`, `is_active`, `account_type` (selector, dikunci kalau sudah dipakai transaksi).

**Beda penting dari Kategori**: field `icon`/`color` di Akun **AKTIF dipakai** UI desktop (bukan kolom mati seperti `categories.icon`). Solusi "emoji nempel di nama" yang dipakai untuk porting Kategori **belum tentu cocok di sini** — preseden desktop-nya memang field terpisah yang aktif, perlu didiskusikan ulang bentuk UI-nya untuk mobile (lihat Keputusan).

### Pemakaian di form transaksi (referensi desktop)

- Field `account_id` ("Akun") dan `transfer_account_id` ("Ke Akun", muncul saat `type === "transfer"`) — combobox dengan opsi **create-new inline** (pola sama seperti kategori: ketik nama baru → buka dialog/form create akun → langsung terpakai).
- **Tidak ada filter tipe akun** di kedua combobox itu — semua tipe (cash/debt/investment/third_party) muncul sebagai opsi di keduanya, termasuk di `transfer_account_id` (transfer TIDAK dibatasi harus antar-cash). Satu-satunya pembeda visual adalah badge tipe di tiap opsi.
- Untuk mobile (scope cash-only di awal), ini berarti combobox akun otomatis cuma akan berisi akun cash (karena memang belum ada tipe lain) — tidak perlu logic filter tipe eksplisit dulu, behave sama dengan desktop secara alami.

## Keputusan yang sudah diambil

1. **`account_groups`**: **ikut porting awal**. Akun tidak flat — grouping (accordion per grup, "Tanpa Grup" di akhir seperti desktop) jadi bagian dari skema+CRUD sejak awal, bukan menyusul.
2. **`deleted_at`**: **skip**. Konsisten sama desktop yang sendiri tidak memakai kolom ini (hard delete murni) — mobile tidak perlu field ini sama sekali untuk `accounts`.
3. **`sync_source`**: **tidak masuk fase awal**. Ditunda sampai semua porting lokal (semua tipe akun — cash, debt, investment, third_party — bukan cuma cash) selesai; soal sinkronisasi MCP↔desktop dibahas ulang nanti sebagai putaran kerja terpisah.
4. **`icon`/`color`**: **dipakai, bukan skip**. `color` disimpan sebagai value langsung (hex/string), tidak butuh mapping khusus. `icon` disimpan sebagai string identifier terpisah (BUKAN ditempel ke `name` seperti pola kategori) — tapi karena RN tidak bisa reuse icon picker/library ikon desktop (web), perlu dibuat **mapping nama-ikon → komponen ikon RN** (daftar ikon valid yang bisa dipilih user dan dirender di mobile). Desain mapping ini sendiri belum dikerjakan — baru keputusan bahwa pendekatannya mapping, bukan bentuk konkretnya.
5. **Balance Correction**: **ikut porting awal**. Berarti kolom `transactions.is_cash_neutral` wajib ditambahkan lewat migrasi terpisah ke tabel `transactions` yang sudah ada (pola sama seperti migrasi `0004_transaction_category_fk.ts` di porting Kategori — lihat bagian Balance Correction di atas untuk detail behavior `is_cash_neutral`).

## Keputusan yang masih perlu diambil sebelum mulai coding

- **Scope MVP list/summary/detail**: CRUD akun dasar + saldo on-the-fly + field picker di form transaksi (pola identik Kategori) dulu, ATAU sekalian include list/summary lengkap ala desktop (accordion grup, pie chart, detail dialog)? (Catatan: grouping sendiri sudah diputuskan ikut porting awal di atas — ini soal kedalaman UI list/summary-nya, bukan soal ada/tidaknya grup.)
- **Bentuk konkret mapping icon**: daftar ikon apa saja yang valid untuk mobile, lib/sumber ikonnya apa (mis. `@expo/vector-icons` set mana), dan apakah identifier yang disimpan di DB desktop (kemungkinan nama ikon dari lib web, misal Lucide) bisa/perlu dipetakan 1:1 ke ikon RN yang paling mirip, atau dibuat daftar baru independen untuk mobile.
- **Urutan pengerjaan**: identik pola Kategori (skema+migrasi → CRUD mandiri → field picker form transaksi → inline-create) adalah urutan yang masuk akal dan sudah terbukti jalan — ada alasan untuk menyimpang dari urutan ini di sini?
- **Cash opname**: `apps/desktop` financial-app TIDAK punya fitur ini — istilah yang sama dipakai di domain Warung Aqil (toko retail/POS terpisah, tool MCP `get_cash_opname_list`/`get_cash_opname_detail`), bukan bagian dari financial-app pribadi. Kalau mobile mau punya fitur serupa, ini perancangan baru dari nol, perlu didiskusikan konsepnya, bukan diasumsikan otomatis dari Balance Correction yang sudah ada — dan bukan sesuatu yang bisa dicek strukturnya dari kode desktop financial-app karena memang tidak ada di sana.

## Catatan

- Rumus saldo on-the-fly WAJIB direplikasi persis (bukan diturunkan ulang secara independen) supaya tidak ada risiko angka beda antara mobile dan desktop/worker untuk akun yang sama (relevan kalau nanti ada sinkronisasi data).
- Pola dialog delete dengan pilihan unassign/reassign mirip banget dengan pola "lepas vs hapus beserta sub-kategori" yang sudah dibuat untuk kategori (`categories/[id]/edit.tsx`) — kemungkinan besar reusable sebagai referensi struktur `Alert.alert` multi-opsi, walau isinya beda (akun tujuan reassign vs cuma unassign, bukan pilihan cascade).
