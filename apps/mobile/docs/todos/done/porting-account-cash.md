
# Porting Akun Tipe Cash (Desktop → Mobile) — SELESAI

Dokumen anak dari [porting-account.md](../plan/porting-account.md) — fokus khusus tipe `cash`. Baca induknya dulu untuk konteks kenapa porting akun dipecah per tipe.

## Status & TODO saat ini (ringkas)

**Porting akun tipe cash SELESAI** — semua item wajib sudah diimplementasikan dan teruji lewat dogfooding (lihat bagian Keputusan untuk detail tiap poin, termasuk 5 bug yang ditemukan & diperbaiki selama proses). Penjelasan lengkap tiap poin ada di bagian-bagian di bawah.

- [x] Baca konsep [konsep-tipe-akun.md](../../../../../docs/concept/konsep-tipe-akun.md) — wajib, lihat juga `porting-account.md`.
- [x] Skema database `accounts` + `account_groups` untuk mobile (ikut porting awal, tanpa `deleted_at`/`sync_source`) — sudah ditulis di `0005_accounts.ts`, lihat bagian Skema & Keputusan.
- [x] Migrasi tambahan `transactions.is_cash_neutral` (untuk Balance Correction, ikut porting awal) — sudah ditulis di `0006_transaction_cash_neutral.ts`, lihat bagian Keputusan.
- [x] Mapping nama-ikon → komponen render untuk field `icon` (RN tidak bisa reuse icon picker desktop) — `lucide-react-native` terinstall, `src/lib/account-icons.ts` + `account-colors.ts` sudah dibuat (identik whitelist desktop), lihat bagian Keputusan. Picker UI-nya sendiri belum dikerjakan, menyusul di item CRUD/field form.
- [x] CRUD akun dasar (list, create, update, delete dengan unassign/reassign, toggle aktif) — selesai, lihat bagian CRUD dan Keputusan #1/#4 untuk detail implementasi.
- [x] Perhitungan saldo on-the-fly (bukan kolom tersimpan) — selesai, direplikasi persis di `use-accounts.ts`, lihat bagian Saldo.
- [x] UI pemilihan akun di form transaksi (`account_id`, `transfer_account_id`) + inline-create — selesai, `AccountPickerSheet` 2 level ala Kategori, reuse `AccountForm` lengkap untuk create-inline (bukan form mini), lihat bagian Keputusan.
- [x] Balance Correction (koreksi saldo) — selesai, field "Saldo Terkini" di luar `AccountForm`, Alert Ya/Tidak untuk `is_cash_neutral`, lihat bagian Keputusan #7.
- **DI LUAR CAKUPAN dokumen ini — Cash opname**: **bukan fitur `apps/desktop` financial-app** — itu fitur domain Warung Aqil (tool MCP `get_cash_opname_list`/`get_cash_opname_detail`, aplikasi retail/POS terpisah), bukan bagian dari aplikasi pribadi yang sedang di-porting. Bukan item porting yang "belum dikerjakan" — ini memang tidak termasuk scope porting akun cash sama sekali. Kalau suatu saat mau ada di financial-app, itu perancangan fitur baru dari nol (konsep belum ada), bukan lanjutan dokumen ini — lihat bagian Catatan.

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

**Blocker porting (SELESAI)**: kolom `transactions.is_cash_neutral` sudah ditambahkan lewat migrasi `0006_transaction_cash_neutral.ts` (`ALTER TABLE ... ADD COLUMN`, bukan copy-and-rename seperti `0004` — cukup kolom nullable-default baru, tanpa FK baru). Balance Correction sendiri sudah diimplementasikan juga — lihat Keputusan #7.

### Field form (referensi desktop)

Field universal (relevan untuk cash): `name`, `initial_balance`, `icon`, `color`, `group_id`, `description`, `is_active`, `account_type` (selector, dikunci kalau sudah dipakai transaksi).

**Beda penting dari Kategori**: field `icon`/`color` di Akun **AKTIF dipakai** UI desktop (bukan kolom mati seperti `categories.icon`). Solusi "emoji nempel di nama" yang dipakai untuk porting Kategori **belum tentu cocok di sini** — preseden desktop-nya memang field terpisah yang aktif, perlu didiskusikan ulang bentuk UI-nya untuk mobile (lihat Keputusan).

### Pemakaian di form transaksi (referensi desktop)

- Field `account_id` ("Akun") dan `transfer_account_id` ("Ke Akun", muncul saat `type === "transfer"`) — combobox dengan opsi **create-new inline** (pola sama seperti kategori: ketik nama baru → buka dialog/form create akun → langsung terpakai).
- **Tidak ada filter tipe akun** di kedua combobox itu — semua tipe (cash/debt/investment/third_party) muncul sebagai opsi di keduanya, termasuk di `transfer_account_id` (transfer TIDAK dibatasi harus antar-cash). Satu-satunya pembeda visual adalah badge tipe di tiap opsi.
- Untuk mobile (scope cash-only di awal), ini berarti combobox akun otomatis cuma akan berisi akun cash (karena memang belum ada tipe lain) — tidak perlu logic filter tipe eksplisit dulu, behave sama dengan desktop secara alami.
- **Riset create-inline desktop**: `CreateAccountDialog` (`apps/desktop/.../transactions/form/add-edit/components/fields/create-account-dialog.tsx`) TIDAK punya form mini sendiri — reuse penuh `AccountForm` yang sama dipakai di halaman Akun biasa (field lengkap: nama, saldo awal, icon/color, grup, **selector account_type aktif tidak terkunci** — `accountTypeLocked` default `false`), cuma `name` di-prefill dari query combobox. Ini jadi acuan langsung implementasi mobile di bawah (Keputusan #6).

## Keputusan yang sudah diambil

1. **`account_groups`**: **ikut porting awal**. Akun tidak flat — grouping (accordion per grup, "Tanpa Grup" di akhir seperti desktop) jadi bagian dari skema+CRUD sejak awal, bukan menyusul.
   - **Beda dari desktop — tidak ada menu/halaman "Grup Akun" terpisah**: desktop punya halaman CRUD penuh sendiri untuk grup (`/master-data/account-groups`, menu sidebar sejajar "Akun") karena `account_groups` tabel independen (beda dari Kategori yang groupingnya self-referencing `parent_id`, tanpa entitas terpisah). Untuk mobile, diputuskan **gabung ke halaman Akun** — tidak ada item menu "Grup Akun" di "Lainnya" (sudah dihapus dari `more.tsx`).
   - **Bentuk UI konkret (DIPUTUSKAN & SELESAI)**: satu FAB "+" di halaman Akun (`app/accounts/index.tsx`) membuka `app/accounts/new.tsx`, satu form/sheet yang sama untuk kedua entitas lewat `AccountForm` (`features/accounts/form/account-form.tsx`). Baris paling atas form berupa **toggle** `kind: "account" | "group"` (pakai `FormFieldToggleGroup`, field biasa di schema — bukan `z.discriminatedUnion`, cukup `z.object` datar karena React Hook Form butuh default values stabil untuk semua field terlepas kind-nya). Field di bawah toggle berubah mengikuti pilihan via `useWatch` di komponen `AccountFormFields` (lihat catatan rules-of-hooks di bawah): mode "Akun" menampilkan field lengkap (icon, color, grup, saldo awal, deskripsi, status aktif — lihat Keputusan #4), mode "Grup Akun" cuma `name`. `onSubmit` di `new.tsx` bercabang `INSERT INTO account_groups` vs `INSERT INTO accounts` berdasarkan `values.kind`.
   - **Edit & delete grup (SELESAI)**: ikon pensil di header accordion grup (`account-accordion-section.tsx`, cuma muncul untuk grup sungguhan, bukan section "Tanpa Grup") navigasi ke `app/accounts/group/[id]/edit.tsx` — reuse `AccountForm` dengan `kind: "group"` + prop baru `hideKindToggle` (toggle disembunyikan karena baris yang sedang diedit sudah pasti salah satu dari dua kind, tidak bisa "pindah jenis"). Delete grup: `Alert.alert` konfirmasi, menyebutkan jumlah akun yang akan jadi "Tanpa Grup" kalau ada — aman di level DB karena FK `accounts.group_id` sudah `ON DELETE SET NULL` (migrasi `0005`) dan `PRAGMA foreign_keys = ON` aktif (migrasi `0002`), tidak perlu guard tambahan di kode.
   - **Catatan teknis — rules-of-hooks**: `useWatch` awalnya dipanggil langsung di callback `children={(form) => {...}}` milik `BaseForm` — ini melanggar `react-hooks/rules-of-hooks` (callback render-prop bukan komponen React yang sah). Diperbaiki dengan ekstrak jadi komponen `AccountFormFields` tersendiri.
2. **`deleted_at`**: **skip**. Konsisten sama desktop yang sendiri tidak memakai kolom ini (hard delete murni) — mobile tidak perlu field ini sama sekali untuk `accounts`.
3. **`sync_source`**: **tidak masuk fase awal**. Ditunda sampai semua porting lokal (semua tipe akun — cash, debt, investment, third_party — bukan cuma cash) selesai; soal sinkronisasi MCP↔desktop dibahas ulang nanti sebagai putaran kerja terpisah.
4. **`icon`/`color`**: **dipakai, bukan skip**.
   - **Riset desktop** (`apps/desktop/src/lib/account-colors.ts`, `account-icons.ts`): KEDUANYA whitelist terbatas, bukan picker bebas. `color` disimpan sebagai **nama** dari 10 warna (`slate, red, orange, amber, green, teal, blue, indigo, purple, pink`), bukan hex — lookup ke className Tailwind di desktop. `icon` disimpan sebagai **nama identifier Lucide** dari whitelist 18 icon (`Wallet, Banknote, PiggyBank, Landmark, CreditCard, Coins, TrendingUp, Bitcoin, Building2, HandCoins, Gem, Home, Car, Plane, ShoppingBag, Smartphone, Receipt, Gift`), default `Wallet`, dengan fallback resolver kalau nama tidak dikenali/null.
   - **Keputusan mobile — icon**: pakai `lucide-react-native` (bukan `@expo/vector-icons`/Ionicons). Alasan: nama identifier yang sudah tersimpan di DB desktop (dan akan dipakai mobile) cocok 1:1 tanpa mapping/translasi manual sama sekali — tinggal `import { Wallet, Banknote, ... } from "lucide-react-native"` lalu lookup by name, persis pola `resolveAccountIcon` di desktop. Dependensi `react-native-svg` (peer wajib paket ini) **sudah terpasang** (`15.16.0` di `package.json`), jadi tidak ada konflik versi. Install dengan `npx expo install lucide-react-native` saat mulai implementasi (sesuai `AGENTS.md`, jangan `npm add` langsung).
   - **Keputusan mobile — color**: replikasi whitelist 10 nama warna yang sama dari desktop (bukan bikin daftar baru independen), supaya data `color` yang sama persis juga valid dipakai lintas app kalau nanti ada sinkronisasi. Lookup nama → style di mobile pakai className NativeWind (`text-green-600`/`bg-green-600`, dst — sudah dipakai project ini) sebagai pengganti className Tailwind desktop, jadi pola resolver (`resolveAccountColorText` dengan fallback ke `slate`) juga bisa direplikasi langsung.
   - **Implementasi lib (SELESAI)**: `lucide-react-native@^1.63.0` terinstall via `npx expo install`. `apps/mobile/src/lib/account-icons.ts` + `account-colors.ts` sudah dibuat, isi whitelist identik dengan desktop (termasuk resolver `resolveAccountIcon`/`resolveAccountColorText` dengan fallback default). `account-colors.ts` juga dapat `resolveAccountColorHex` tambahan (lihat catatan NativeWind di bawah) — bukan cuma className seperti rencana awal.
   - **Implementasi picker UI (SELESAI)**: `IconPickerField` (`features/accounts/form/fields/icon-picker.tsx`) — tombol trigger (icon terpilih + nama) membuka `BottomSheetModal` grid semua 18 icon, pola sama seperti Popover grid desktop. `ColorPickerField` (`features/accounts/form/fields/color-picker.tsx`) — swatch bulat inline untuk 10 warna, tanpa sheet terpisah (cukup kecil). Keduanya dipasang di `AccountFields`, cuma tampil saat `kind === "account"`.
   - **Catatan teknis — NativeWind tidak otomatis styling SVG pihak ketiga**: rencana awal pakai `className` NativeWind langsung di komponen icon Lucide (`LucideProps` memang punya field `className?: string`) tidak dipakai karena project belum setup `cssInterop` untuk komponen non-primitif RN — tanpa itu className kemungkinan tidak ter-resolve jadi warna sungguhan. Solusinya: tambah `resolveAccountColorHex` (hex langsung) di `account-colors.ts`, dipakai via prop `color` biasa (sama seperti `Ionicons` yang sudah dipakai lintas app) — bukan via `className`.
   - **Catatan teknis — render icon dinamis & lint `react-hooks/static-components`**: assign komponen hasil resolver ke variabel berawalan huruf besar lalu di-JSX-kan langsung (`const Icon = resolveAccountIcon(...); <Icon />`) kena false-positive aturan ESLint `react-hooks/static-components` ("component dibuat selama render"). Diatasi dengan `createElement(resolveAccountIcon(...), props)` langsung di tempat pakai (di `account-list-item.tsx` dan `icon-picker.tsx`), menghindari pola JSX capitalized-variable yang dicurigai linter.
5. **Balance Correction**: **ikut porting awal, SELESAI**. Kolom `transactions.is_cash_neutral` ditambahkan lewat migrasi terpisah (pola sama seperti `0004_transaction_category_fk.ts` di porting Kategori). Detail implementasi lengkap ada di Keputusan #7.
6. **UI pemilihan akun di form transaksi (SELESAI)**: `AccountPickerSheet` (`features/accounts/content/account-picker-sheet.tsx`) — adaptasi `CategoryPickerSheet` dengan **2 level navigasi ala Kategori** (bukan `SectionList` datar seperti draft awal, diganti setelah diskusi eksplisit): root sheet berisi baris grup (tap → chevron → child sheet berisi akun grup itu) DICAMPUR akun tanpa grup (tap → langsung terpilih) — beda dari kategori, grup di sini **tidak pernah** langsung terpilih sebagai value (grup bukan akun). `FormFieldAccount` (`features/transactions/form/fields/form-field-account.tsx`) — adaptasi generik `FormFieldCategory`, dipakai untuk `account_id` maupun `transfer_account_id` lewat prop `name`. `transaction-form.tsx` dan `transactionSchema` **tidak perlu diubah** selain ganti field (schema tetap `z.string()`, cuma sumber input berubah dari teks bebas jadi ID dari picker).
   - **Create-inline (SELESAI, reuse `AccountForm` penuh)**: sesuai riset desktop di atas, sheet create akun reuse `AccountForm` yang sama dipakai halaman Akun (bukan form mini "cuma nama" seperti draft pertama) — field icon, warna, grup (prefill otomatis sesuai konteks dibuka dari root/child), saldo awal, deskripsi, status aktif semuanya tersedia saat create-inline dari form transaksi. `account_type` tetap dikunci `"cash"` (scope boundary fase ini, bukan oversight) — begitu tipe lain diporting dan field selector ditambahkan ke `AccountForm`, otomatis muncul di SEMUA tempat (halaman Akun, edit, create-inline) karena satu komponen dipakai bersama.
   - **Create grup dari picker (SELESAI, setelah diskusi ulang)**: tombol header "+" di root sheet DIGANTI jadi create **grup** baru (bukan akun) — field `name` saja lewat `AccountForm` dengan `kind: "group"` + `hideKindToggle`. Create akun tanpa grup dipindah jadi baris khusus "Akun Baru" di awal list root (synthetic row, `kind: "create-account"`). Query grup root **tidak** memfilter grup kosong (`WHERE EXISTS accounts...` sempat dicoba lalu dilonggarkan) — grup yang baru dibuat harus langsung kelihatan di root supaya bisa langsung diisi, bukan tersembunyi sampai ada akun pertama.
   - **Bug ditemukan & diperbaiki — keyboard menutupi field di dalam sheet create (SELESAI)**: dogfooding menemukan keyboard menutupi field saat mengetik di sheet create akun/grup (`AccountForm` dirender di dalam `BottomSheetModal`). Root cause (dikonfirmasi lewat riset dokumentasi + GitHub issue gorhom): `TextInput` biasa dari react-native (dipakai `FormFieldText`/`FormFieldNumber`) **tidak ter-track** oleh sistem keyboard-avoidance internal `@gorhom/bottom-sheet` — field itu butuh `handleOnFocus`/`handleOnBlur` manual, atau lebih simpel ganti jadi `BottomSheetTextInput`. Mengatur `keyboardBehavior`/`android_keyboardInputMode` di level `BottomSheetModal` saja TIDAK CUKUP kalau field di dalamnya tetap `TextInput` biasa — percobaan pertama gagal karena ini. **Perbaikan final**: tambah prop `inBottomSheet?: boolean` ke `FormFieldText`/`FormFieldNumber` (swap `TextInput`→`BottomSheetTextInput` saat true, default `false` jadi tidak mempengaruhi pemakaian di luar sheet seperti form transaksi/kategori), diteruskan lewat `AccountForm` sampai ke sheet create di `account-picker-sheet.tsx`. Juga `snapPoints` kedua sheet create ditambah opsi lebih besar (`85%→100%`, `40%→70%`) sesuai rekomendasi resmi issue gorhom, memberi "ruang" bagi `keyboardBehavior="extend"` meluas penuh. **Pola ini berlaku umum**: field teks/angka APA PUN yang dirender di dalam `BottomSheetModal` (bukan cuma akun) perlu `inBottomSheet`/`BottomSheetTextInput`, relevan kalau nanti ada form lain yang direnderkan di dalam sheet.
   - **Bug ditemukan & diperbaiki — tombol submit tertutup navigation bar Android (SELESAI, bug terpisah dari keyboard)**: konten sheet cuma pakai padding bawah statis (`pb-4`, 16px), tidak cukup menghindari navigation bar gesture/3-tombol Android — tombol "Simpan & Pilih" ketiban navigation bar dan tidak bisa ditekan. **Perbaikan**: `useSafeAreaInsets().bottom` dipakai sebagai padding bawah dinamis (`insets.bottom + 16`) di keempat `BottomSheetModal`/`BottomSheetScrollView` dalam `account-picker-sheet.tsx` (root, child, create akun, create grup), menggantikan `pb-4` statis.
   - **Fix terpisah — PRAGMA foreign_keys harus di-set ulang tiap init, bukan sekali di migrasi**: ditemukan lewat dogfooding delete grup (bukan bagian UI picker ini, tapi relevan sebagai bug akun pertama yang ditemukan). `PRAGMA foreign_keys = ON` bersifat per-koneksi SQLite, tidak persisten ke file DB — migrasi `0002` cuma men-set-nya SEKALI saat migrasi itu pertama kali jalan, sehingga di koneksi berikutnya (restart app) `ON DELETE SET NULL` pada `accounts.group_id` diam-diam tidak jalan lagi, meninggalkan `group_id` orphan. Diperbaiki: `migrate.ts` sekarang set pragma ini di **setiap** `onInit`. Data lama yang sudah terlanjur orphan dibersihkan lewat migrasi `0007_fix_orphaned_account_group_id.ts`.
7. **Balance Correction (SELESAI)**: implementasi direplikasi persis dari `use-correct-account-balance.ts` desktop (`apps/desktop/src/features/accounts/.../balance-correction/hooks/`) — find-or-create kategori "Penyesuaian Saldo" per tipe income/expense, `diff = targetBalance - currentBalance` (skip kalau `0`), tipe transaksi dari tanda diff, `amount = Math.abs(diff)`, note selalu "Koreksi saldo", `is_cash_neutral = countAsCash ? 0 : 1`. Logic murni ada di `features/accounts/correct-account-balance.ts` (reusable, tidak terikat UI).
   - **Keputusan UI (sesuai diskusi eksplisit)**: field "Saldo Terkini" ditempatkan **di luar** `AccountForm`/`accountFormSchema` sepenuhnya (bukan field form biasa) — dirender manual di `app/accounts/[id]/edit.tsx` lewat komponen `CurrentBalanceField` (`features/accounts/content/current-balance-field.tsx`), state lokal `useState` biasa, bukan `Controller` React Hook Form. Alasan: perubahan field ini punya alur commit berbeda (insert transaksi penutup via Alert, bukan UPDATE kolom biasa), jadi `AccountForm` tetap schema-nya bersih dan dipakai di 3 tempat lain (create, create-inline) tanpa perlu tahu soal balance correction sama sekali.
   - **Satu tombol submit, bukan tombol terpisah**: saat "Simpan Perubahan" ditekan, `handleSubmit` di `edit.tsx` dulu jalankan UPDATE field akun biasa (`saveAccountFields`), BARU bandingkan nilai "Saldo Terkini" terhadap **snapshot saldo on-the-fly sebelum submit** (`originalBalance`, bukan dihitung ulang setelah UPDATE — supaya tidak tercampur dengan perubahan `initial_balance` yang mungkin diedit bersamaan di form yang sama). Kalau beda → `Alert.alert` "Hitung sebagai kas riil?" dengan 2 tombol (Ya/Tidak, bukan checkbox — sesuai permintaan eksplisit), masing-masing memanggil `correctAccountBalance` dengan `countAsCash` sesuai jawaban.
   - **Khusus tipe cash, hanya di edit (bukan create)**: field ini cuma masuk akal untuk akun yang sudah punya riwayat transaksi, jadi sengaja TIDAK ada di `new.tsx`/create-inline picker — cuma dirender di `[id]/edit.tsx`. "Khusus tipe cash" otomatis terpenuhi tanpa guard eksplisit karena scope mobile saat ini memang cash-only (`account_type` dikunci `z.literal("cash")`) — kalau nanti tipe lain diporting, perlu ditambah guard `accountType === "cash"` di sini (desktop sendiri punya `isAccountTypeRestrictedFromBalanceCorrection` yang melarang `debt`/`third_party` dikoreksi langsung, relevan untuk referensi nanti).
   - **Bug ditemukan & diperbaiki — agregasi cashflow belum filter `is_cash_neutral` (SELESAI)**: dogfooding menemukan transaksi "Koreksi saldo" yang dijawab "Tidak" (harusnya exclude dari cashflow) tetap ikut terhitung di ringkasan Pemasukan/Pengeluaran halaman Transaksi. Root cause: kolom `is_cash_neutral` (migrasi `0006`) belum pernah benar-benar diisi `1` oleh fitur apa pun sampai Balance Correction ini — jadi query agregasi yang sudah ada dari awal tidak pernah memfilternya, bug laten yang baru kelihatan sekarang. Diperbaiki: `use-transaction-summary.ts` (ringkasan header Pemasukan/Pengeluaran/Total) dan `use-month-summary.ts` (ringkasan per-hari tab Kalender) sekarang exclude `is_cash_neutral = 1` di dalam `CASE WHEN` agregasi SUM. **Sengaja TIDAK diubah**: `use-accounts.ts` (saldo per akun) dan saldo on-the-fly di `accounts/[id]/edit.tsx` — saldo akun harus tetap utuh termasuk koreksi administratif, karena `is_cash_neutral` cuma mempengaruhi laporan cashflow, bukan saldo akun itu sendiri (sesuai konsep desktop).

## Keputusan yang sempat terbuka, sekarang sudah terjawab

- **Scope MVP list/summary/detail (TERJAWAB oleh praktik)**: CRUD akun dasar + saldo on-the-fly dulu, SELESAI dengan scope list sederhana (accordion grup + total saldo per grup di header, item akun nama+icon+saldo+status) — bukan pie chart/detail dialog lengkap ala desktop. Itu menyusul kalau dibutuhkan, bukan bagian wajib porting awal.
- **Cash opname — DI LUAR CAKUPAN, bukan "belum selesai"**: `apps/desktop` financial-app TIDAK punya fitur ini — istilah yang sama dipakai di domain Warung Aqil (toko retail/POS terpisah, tool MCP `get_cash_opname_list`/`get_cash_opname_detail`), bukan bagian dari financial-app pribadi. Kalau mobile mau punya fitur serupa, ini perancangan baru dari nol, perlu didiskusikan konsepnya, bukan diasumsikan otomatis dari Balance Correction yang sudah ada — dan bukan sesuatu yang bisa dicek strukturnya dari kode desktop financial-app karena memang tidak ada di sana. Tidak menghalangi dokumen ini ditutup sebagai selesai.

## Catatan

- Rumus saldo on-the-fly WAJIB direplikasi persis (bukan diturunkan ulang secara independen) supaya tidak ada risiko angka beda antara mobile dan desktop/worker untuk akun yang sama (relevan kalau nanti ada sinkronisasi data).
- Pola dialog delete dengan pilihan unassign/reassign mirip banget dengan pola "lepas vs hapus beserta sub-kategori" yang sudah dibuat untuk kategori (`categories/[id]/edit.tsx`) — kemungkinan besar reusable sebagai referensi struktur `Alert.alert` multi-opsi, walau isinya beda (akun tujuan reassign vs cuma unassign, bukan pilihan cascade).
