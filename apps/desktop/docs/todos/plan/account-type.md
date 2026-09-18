# Account Type

## Latar belakang

Saat ini akun cuma punya `group_id` (label pengelompokan bebas, tidak mempengaruhi perilaku).
Rencananya akun akan punya `account_type` yang memang mempengaruhi perilaku & data tambahan yang dimiliki tiap akun.

Contoh tipe: `cash`, `credit`, `investment`, `forex`, dst.
Tiap tipe berpotensi punya field/fitur sendiri:
- **Kredit** — limit, tanggal jatuh tempo, bunga
- **Investasi** — jumlah unit, harga per unit, return
- **Valas** — mata uang asal, kurs konversi

## Rencana pendekatan

- Kolom `account_type` di tabel `accounts` — `TEXT NOT NULL DEFAULT 'cash'` + `CHECK (account_type IN (...))` (SQLite tidak punya ENUM asli, emulasi lewat TEXT + CHECK, sama pola dengan `transactions.type`).
- Tabel detail terpisah per tipe yang butuh field ekstra kompleks (misal `credit_accounts`, `investment_accounts`), masing-masing `account_id` merujuk ke `accounts.id`. Hindari kolom JSON generik supaya validasi SQL tetap kuat untuk data finansial.
- `features/accounts/` tetap jadi shell umum yang menampilkan semua akun apa pun tipenya. Tiap tipe kompleks (kredit, investasi) dapat feature folder sendiri (`features/credit-accounts/`, dst) dengan form & logic masing-masing.

## Catatan penting

- Menambah varian `account_type` baru di kemudian hari **tidak bisa** cuma `ALTER TABLE` — SQLite tidak izinkan ubah `CHECK` constraint yang sudah ada. Harus pakai teknik "copy-and-rename" (lihat pola di `migrations/0004_allow_transfer_type.sql`).
- Karena itu, sebaiknya daftar tipe akun awal dipikirkan cukup matang sebelum implementasi, supaya tidak sering revisi constraint.
- TypeScript tetap jadi lapisan validasi utama (union type + zod enum), SQLite `CHECK` cuma jaring pengaman terakhir.

## Belum diputuskan

- Daftar final tipe akun yang mau didukung di awal.
- Field spesifik tiap tipe (baru dibahas kredit/investasi/valas sebagai contoh, belum final).

## Use case yang menunggu fitur ini

- Panel pie chart di halaman Akun (`AccountBalancePieChart`) saat ini punya 2 tab: "Per Akun" dan "Per Grup Akun" (`account_groups`). Sempat ditanyakan apakah bisa ditambah tab "Per Tipe Akun" — belum bisa, karena `account_type` belum ada sebagai kolom sungguhan di database, masih sebatas rencana di dokumen ini. Begitu `account_type` diimplementasikan, tambahkan tab ketiga di `src/features/accounts/balance-pie-chart.tsx` (pola sudah ada: tinggal buat `useAccountTypeBalances()` mirip `use-account-group-balances.ts`, lalu tambah `TabsTrigger`/`TabsContent` baru).
