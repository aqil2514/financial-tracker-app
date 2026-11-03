
# Porting Akun Tipe Dana Pihak Ketiga (Desktop → Mobile) — SELESAI

Dokumen anak dari [porting-account.md](porting-account.md) — fokus khusus tipe `third_party`. Baca induknya dulu untuk konteks kenapa porting akun dipecah per tipe, dan baca [porting-account-cash.md](porting-account-cash.md), [porting-account-debt.md](porting-account-debt.md), serta [porting-account-investment.md](porting-account-investment.md) sebagai referensi pola yang sudah terbukti (CRUD akun, saldo on-the-fly, picker, guard, pemisahan logic ke `shared/<domain>/`, test SQLite asli). Tipe `third_party` WARIS semua itu; dokumen ini cuma menambahkan apa yang KHUSUS untuk `third_party`.

**Wajib baca sebelum implementasi**: [konsep-tipe-akun.md](../../../../../docs/concept/konsep-tipe-akun.md) dan [konsep-dana-pihak-ketiga.md](../../../../../docs/concept/konsep-dana-pihak-ketiga.md). Aturan krusial yang tidak boleh terlewat: titip dan ambil adalah `income`/`expense` satu sisi pada akun `third_party` (BUKAN transfer dengan kas), dan transaksi di akun `third_party` dikecualikan dari agregat cashflow.

## Status & TODO saat ini (ringkas)

**Porting akun tipe Dana Pihak Ketiga SELESAI (2026-11-03).** Keenam langkah "Rencana urutan kerja" sudah dikerjakan (migrasi, logic `shared/third-party-funds/`, tipe akun di form/badge/picker/hapus akun/Balance Correction, layar Dana Pihak Ketiga, form Catat Titip/Ambil dan Pindah, edit/hapus baris riwayat, sambungan ke halaman Transaksi, pengecualian cashflow), lolos test SQLite asli, dan lima skenario kunci sudah dicoba di device (lihat item verifikasi di bawah). Yang sengaja di luar cakupan: sync, Koreksi Nominal granular, dan edit baris transfer. Riset di bawah berasal dari desktop (`apps/desktop/src/shared/third-party-funds/`, `apps/desktop/src/features/third-party/`, [account-type-third-party.md](../../../../desktop/docs/todos/done/account-type-third-party.md), [third-party-fund.md](../../../../desktop/docs/tables/third-party-fund.md)) dan kondisi kode mobile.

- [x] Riset desktop: model data, tiga jenis pergerakan, guard, dan pengecualian cashflow (lihat bagian "Riset" di bawah).
- [x] Riset kondisi mobile: titik-titik kode yang menyebut `third_party` atau perlu disentuh (lihat "Kondisi mobile saat ini").
- [x] Putuskan keputusan terbuka (bentuk layar, scope edit/hapus, sync) — semua disetujui user 2026-11-03, lihat "Keputusan".
- [x] Skema database mobile: migrasi `0010_third_party_funds.ts` (tabel `third_party_funds` tanpa kolom sync), didaftarkan di `migrations/index.ts`, plus dokumen [third-party-fund.md](../../tables/third-party-fund.md).
- [x] `classifyAccountPair` mobile: tambah `third_party-third_party` (dengan test); `applyDebtTransaction` diberi guard no-op untuk pasangan ini supaya tidak jatuh ke cabang debt→kas (pola sama investasi).
- [x] Logic inti `shared/third-party-funds/` (selesai 2026-11-03, 19 test SQLite asli): `getRemainingThirdPartyFund` (param opsional `excludeFundId`), `recordThirdPartyFund` (titip/ambil, atomik, cek oversell), `recordThirdPartyTransfer` (dua baris), `updateThirdPartyFund`, `detachThirdPartyFundsForDeletedTransaction`, `deleteThirdPartyFundEntry`, `getTransactionThirdPartyFund`, `InsufficientThirdPartyFundError`, `ThirdPartyFundEditBlockedError`. Lihat "Catatan implementasi logic" di bawah.
- [x] Field akun `third_party` di `AccountForm` mobile: toggle tipe "Dana Pihak Ketiga" (tanpa field tambahan), badge amber di `account-list-item.tsx` (entri di `lib/account-types.ts`), dan field Saldo Awal disembunyikan + dipaksa 0 (aturan desktop: setiap rupiah harus bisa ditelusuri ke kontak lewat `third_party_funds`; zod refine menolak saldo awal ≠ 0).
- [x] Layar Dana Pihak Ketiga (hanya baca): `app/third-party/index.tsx` satu layar tanpa tab — statistik Total Titipan, Ringkasan per Kontak (dikelompokkan per kontak, rinci per akun), daftar akun dengan saldo, riwayat titip/ambil/pindah. Query di `shared/third-party-funds/third-party-fund-queries.ts` (3 test SQLite asli), hook `useThirdPartyData` (refetch saat layar fokus), komponen di `features/third-party/content/`, entri di `more.tsx`. Tombol aksi dan edit/hapus baris menyusul di langkah 5. Belum dicoba di device.
- [x] Layar Catat Titip/Ambil: `app/third-party/record.tsx` + `features/third-party/form/` (`schema.ts`, `record-fund-form.tsx`). Toggle Titip/Ambil, pilih akun `third_party` aktif, kontak, nominal (kalkulator), tanggal, catatan opsional (default "Titip dana"/"Ambil dana"), dan petunjuk sisa titipan kontak itu di akun itu. Tombol Titip/Ambil di layar utama membuka layar ini dengan arah terisi lewat param `direction`. `FormFieldContact` digeneralisasi (prop `name`/`label`) supaya bisa dipakai dua kali di form Pindah. Belum dicoba di device.
- [x] Layar Pindah Tempat/Kepemilikan: `app/third-party/move.tsx` + `move-fund-form.tsx` + `moveFundFormSchema` (8 test di `schema.test.ts`), tombol Pindah di layar utama. Toggle `kind` (Pindah Tempat / Pindah Kepemilikan / Keduanya) menyembunyikan field yang otomatis disamakan dengan sisi asal (`resolveMoveDestination`): pindah tempat → kontak tujuan = kontak asal, pindah kepemilikan → akun tujuan = akun asal. Tujuan sama dengan asal ditolak di skema. Belum dicoba di device.
- [x] Tipe Akun di `AccountForm` diganti dari toggle ke select (`FormFieldSelect`) karena empat opsi tidak muat satu baris (permintaan user 2026-11-03).
- [x] Edit baris direct dan hapus baris dari riwayat: ketuk baris direct membuka `app/third-party/[id]/edit.tsx` (nominal, tanggal, catatan; akun/kontak/jenis hanya ditampilkan), ikon tempat sampah per baris memanggil `deleteThirdPartyFundEntry` setelah konfirmasi (pesan khusus untuk baris transfer: pasangannya ikut terhapus). Baris transfer tidak bisa diketuk. `InsufficientThirdPartyFundError` dan `ThirdPartyFundEditBlockedError` ditangkap jadi Alert. Query satu baris `getThirdPartyFund`. Belum dicoba di device.
- [x] Guard picker akun form transaksi: akun `third_party` disembunyikan permanen dari `account-picker-sheet.tsx` (dua query `account_type NOT IN ('investment', 'third_party')`), opsi tipe disembunyikan di create-inline picker (prop `hideThirdPartyType` di `AccountForm`). Daftar tujuan "Pindahkan Transaksi Dulu" saat hapus akun juga tidak lagi menawarkan akun investasi/`third_party`.
- [x] Halaman Transaksi (`app/transactions/[id]/edit.tsx`): hapus memanggil `detachThirdPartyFundsForDeletedTransaction` dalam `withTransactionAsync` yang sama dengan `DELETE FROM transactions` (blok `ThirdPartyFundEditBlockedError` ditangkap jadi Alert, pemberitahuan kalau riwayat ikut terhapus); edit transaksi yang punya baris `third_party_funds` diblok dengan pesan yang mengarahkan ke layar Dana Pihak Ketiga. Belum dicoba di device.
- [x] Hapus akun `third_party` yang masih punya riwayat ditolak total (`handleDelete` di `app/accounts/[id]/edit.tsx` menghitung `third_party_funds` lebih dulu, sebelum jalur unassign/reassign). Belum dicoba di device.
- [x] Pengecualian cashflow: `EXCLUDE_THIRD_PARTY_TRANSACTIONS_SQL` (`shared/third-party-funds/cashflow-filter.ts`, `NOT EXISTS` ke `accounts.account_type = 'third_party'`) dipakai di `use-month-summary.ts` (badge kalender) dan `use-transaction-summary.ts` (ringkasan di daftar Transaksi), bersama `is_cash_neutral = 0`. `use-accounts.ts` dan `investment-queries.ts` sengaja tidak disentuh (saldo/riwayat per akun, bukan agregat lintas akun). 2 test SQLite asli di `cashflow-filter.test.ts`. Daftar transaksi itu sendiri tetap menampilkan transaksi titip/ambil.
- [x] Blokir Balance Correction untuk akun `third_party`: pesan di layar edit akun menggantikan field saldo (`handleSubmit` memang hanya mengoreksi tipe `cash`). Pesannya menyebut layar Dana Pihak Ketiga yang baru ada di langkah 4.
- [x] Verifikasi di device (2026-11-03, dikonfirmasi user): (1) titip di akun third_party muncul di daftar Transaksi tapi tidak menambah Pendapatan; (2) menghapus transaksi titipan yang sudah sebagian diambil ditolak; (3) menghapus transaksi ambil berhasil dan sisa titipan pulih; (4) menyimpan edit pada transaksi titip lewat form umum diblok dengan pesan; (5) menghapus akun yang masih punya riwayat ditolak. Catat Titip/Ambil dan oversell sudah terpakai dalam skenario itu. Belum dikonfirmasi eksplisit di device: ketiga jenis Pindah, edit baris direct dari layar Dana Pihak Ketiga, dan hapus baris pindah (semuanya dicover test SQLite asli).
- **DI LUAR CAKUPAN — sync** (`sync_source`, `deleted_at`, kolom `updated_at` otomatis, antrean push): ditunda sampai semua porting lokal selesai, mengikuti keputusan di [porting-account-cash.md](../done/porting-account-cash.md). Bug pull `third_party_funds` di production desktop juga belum terselesaikan, jangan dibuka dari sini.
- **DI LUAR CAKUPAN — Koreksi Nominal granular per baris** (setara "Koreksi Nominal" debt): desktop sendiri sengaja belum mengerjakan; mobile cukup guard tolak-total.
- **DI LUAR CAKUPAN — edit baris transfer** (dua baris berpasangan): desktop belum mendukung; mobile cukup hapus lalu catat ulang.

## Riset: implementasi dana pihak ketiga di desktop

### Model

- Satu akun `third_party` = satu TEMPAT fisik (mis. "Kas Orang Lain [Tunai]", "Kas Orang Lain [Bank Jago]"), bukan satu akun per penitip. Banyak penitip dalam satu akun dibedakan lewat `contact_id` di level data, sama seperti `debts.contact_id`.
- Tabel baru `third_party_funds` (desktop: migrasi `0049`). Kolom: `id`, `account_id` (FK `accounts`, `ON DELETE CASCADE`), `contact_id` (FK `contacts`, NOT NULL, `ON DELETE RESTRICT`), `transaction_id` (FK `transactions`, `ON DELETE SET NULL`), `direction` (`in`/`out`), `amount`, `date`, `note`, plus kolom sync (`created_at`, `updated_at`, `deleted_at`, `sync_source`) yang tidak ikut di mobile fase ini.
- TIDAK ada kolom `status`. Sisa titipan = `SUM(CASE WHEN direction='in' THEN amount ELSE -amount END)` per `(account_id, contact_id)`.
- `direction` disimpan sendiri (bukan dibaca dari `transactions.type`) karena transfer `third_party → third_party` menghasilkan DUA baris per satu transaksi dengan kontak sisi keluar dan masuk yang independen.

### Tiga jenis pergerakan

1. **Titip** = `income` pada akun `third_party` (`direction='in'`), **Ambil** = `expense` (`direction='out'`). Kontak WAJIB. Ambil > sisa titipan kontak itu di akun itu ditolak (`InsufficientThirdPartyFundError`). Tidak melibatkan akun kas sama sekali.
2. **Pindah tempat dan/atau kepemilikan** = `transfer` `third_party → third_party`, dua baris: `out` di (akun asal, kontak asal), `in` di (akun tujuan, kontak tujuan). Oversell dicek di sisi asal. Desktop menyajikannya dengan toggle `kind`: "Pindah Tempat" (akun beda, satu kontak), "Pindah Kepemilikan" (satu akun, kontak beda), "Keduanya" (empat field). `kind` murni presentasi form, tidak disimpan.
3. **Hubungan dengan kas tidak pernah transfer.** Ambil titipan sambil dapat upah, atau titipan dihibahkan jadi milik sendiri, dicatat sebagai DUA transaksi independen (`expense third_party` + `income cash`). Kombinasi `cash-third_party` dan `third_party-cash` SENGAJA tidak diklasifikasi di `classifyAccountPair`.

### Aturan yang dipegang desktop (jebakan yang sudah pernah kena)

- **Validasi dulu, baru insert transaksi.** Draft awal desktop meng-insert `transactions` lebih dulu lalu memanggil validasi oversell, sehingga transaksi hantu tertinggal. Di mobile, bungkus semuanya dalam satu transaksi SQLite atomik (pola `recordInvestmentSale`) dan tetap validasi sebelum menulis.
- **`note` harus diteruskan ke `third_party_funds.note`**, bukan hanya `transactions.note`. Desktop sempat selalu menyimpan NULL di kolom itu padahal daftar riwayat membacanya.
- **Hapus transaksi wajib memanggil `detachThirdPartyFundsForDeletedTransaction`** (hard-delete semua baris `third_party_funds` milik transaksi itu, 1 untuk direct, 2 untuk transfer). FK `SET NULL` saja meninggalkan baris yatim yang masih ikut menghitung sisa titipan. Di mobile: titik yang sama dengan `detachInvestmentSaleForDeletedTransaction` di `app/transactions/[id]/edit.tsx` dan `cleanup-stale-debt-on-account-change.ts`.
- **Hapus akun dengan riwayat ditolak total**, bukan unassign/reassign. FK `account_id ... ON DELETE CASCADE` menghapus riwayat diam-diam saat akun dihapus, dan reassign transaksi tidak ikut memindahkan baris `third_party_funds` (CASCADE tidak jalan pada UPDATE).
- **Edit hanya baris direct, hanya nominal/tanggal/catatan.** Akun, kontak, dan arah terkunci. Validasi oversell edit memakai varian yang MENGECUALIKAN baris yang sedang diedit dari perhitungan sisa.
- **Pengecualian cashflow berbasis `account_type`**, bukan flag baru di `transactions`. Saldo per akun `third_party` tetap menghitung transaksinya apa adanya; yang dikecualikan hanya agregat lintas akun "Pendapatan/Pengeluaran". `is_cash_neutral = 0` dan `account_type != 'third_party'` dipakai bersama.
- **Koreksi Saldo ditolak total** untuk `third_party` (`ACCOUNT_TYPES_RESTRICTED_FROM_BALANCE_CORRECTION`), karena mengoreksi `accounts.balance` tanpa menyentuh `third_party_funds` membuat saldo dan riwayat drift.
- **Query cache perlu invalidasi terpusat.** Desktop sempat lupa mendaftarkan key ringkasan/riwayat ke peta ketergantungan transaksi sehingga list tidak refresh setelah hapus. Di mobile cek mekanisme refetch-on-focus yang sudah dipakai layar investasi, jangan menulis invalidasi manual per mutasi.

## Kondisi mobile saat ini

- `accounts.account_type` sudah menerima `'third_party'` di CHECK (`0005_accounts.ts`). Tabel `contacts` sudah ada dari porting debt. Migrasi terakhir `0009_investments.ts`, jadi tabel baru jadi `0010`.
- `third_party_funds` belum ada.
- `shared/debts/classify-account-pair.ts` belum punya `third_party-third_party`, dan komentar di kepalanya menyebut tipe ini belum diporting. `cleanup-stale-debt-on-account-change.ts` juga punya komentar serupa.
- `features/accounts/content/account-list-item.tsx:20` sengaja memberi `null` badge untuk `third_party`; `lib/account-types.ts` belum punya entri tipe ini; `ACCOUNT_TYPE_OPTIONS` lokal di `account-form.tsx` belum punya opsi "Dana Pihak Ketiga". Tipe `account_type` di `app/accounts/[id]/edit.tsx:37` baru `"cash" | "debt" | "investment"`.
- Picker akun form transaksi (`account-picker-sheet.tsx`) hanya menyembunyikan `investment` (dua query + prop `hideInvestmentType`). Tanpa perubahan, akun `third_party` muncul di picker dan transaksinya tersimpan tanpa baris `third_party_funds`.
- `app/accounts/[id]/edit.tsx`: `deleteAccount` memanggil `DELETE FROM accounts` setelah unassign/reassign transaksi, tanpa mengecek `debts`/`investment_*`/`third_party_funds`. Untuk `third_party` ini akan menghapus riwayat lewat CASCADE (dan reassign tidak memindahkannya). Perlu guard seperti desktop.
- Balance Correction di layar edit hanya jalan untuk `account_type === "cash"` (`handleSubmit` langsung `router.back()` untuk tipe lain), dan sudah punya pesan blokir terpisah untuk `debt` dan `investment` (sekitar baris 257-265). Tinggal menambah pesan untuk `third_party`.
- Agregat cashflow yang menjumlahkan `income`/`expense` dengan `is_cash_neutral = 0`: `features/transactions/calendar/use-month-summary.ts`, `features/transactions/content/use-transaction-summary.ts`. Dua file lain yang menyebut income/expense (`investment-queries.ts`, `use-accounts.ts`) perlu dicek apakah agregat lintas akun atau per akun. Mobile belum punya layar laporan/dashboard, jadi cakupannya jauh lebih kecil dari 9 file desktop.

## Keputusan (disetujui user 2026-11-03)

Nama file `record.tsx` = layar form Catat Titip/Ambil, `move.tsx` = layar form Pindah Tempat/Kepemilikan. "Baris direct" = baris riwayat dari titip/ambil biasa (1 transaksi = 1 baris), lawan "baris transfer" (1 transaksi = 2 baris berpasangan).

1. **Cara mencatat titip, ambil, dan pindah.** Layar khusus saja, TIDAK lewat form transaksi utama, dan akun `third_party` disembunyikan permanen dari picker akun form transaksi. Konsisten dengan keputusan investasi 2026-11-03 dan menghindari percabangan baru di form transaksi.
2. **Struktur layar.** Satu layar `app/third-party/index.tsx` (ringkasan per kontak × akun di atas, lalu daftar akun dengan saldo, lalu riwayat) tanpa tab, plus layar form `record.tsx` (titip/ambil) dan `move.tsx` (pindah, toggle tiga jenis). Desktop memakai tiga tab karena ruang lebar.
3. **Scope edit/hapus.** Mengikuti desktop: edit hanya baris direct (nominal/tanggal/catatan), hapus untuk semua baris, hapus akun dengan riwayat ditolak, Koreksi Saldo ditolak. Satu penyimpangan yang perlu dipilih: desktop mengizinkan edit transaksi leg titip/ambil lewat form transaksi umum karena form utama belum tahu `third_party`; di mobile, edit leg `third_party` lewat form transaksi umum diblok dengan pesan, sama seperti leg penjualan investasi.
4. **Sync.** Tabel mobile lokal saja tanpa kolom sync, dengan HARD DELETE seperti tabel mobile lain (desktop/D1 pakai soft delete). Catat perbedaan ini di `docs/tables/third-party-fund.md` saat tabel dibuat.

## Catatan implementasi logic

- **Guard tambahan yang tidak ada di desktop**: menghapus atau mengurangi nominal sebuah TITIPAN yang sebagian sudah diambil/dipindahkan diblok (`ThirdPartyFundEditBlockedError`), karena sisa titipan kontak itu akan jadi negatif. Desktop hanya memvalidasi oversell untuk baris `out`. Untuk transfer, yang dicek adalah sisi tujuan (`in`) yang sudah dipakai. Menghapus baris `out` selalu boleh. Ini sejalan dengan keputusan investasi (hapus pembelian yang unitnya sudah terjual diblok). UI wajib menangkap `ThirdPartyFundEditBlockedError` dan `InsufficientThirdPartyFundError`.
- **`transactions.note` NOT NULL di mobile** (catatan kosong = string kosong), sedangkan `third_party_funds.note` boleh NULL. Fungsi `record*`/`update*` menerima `note: string | null` dan menulis `note ?? ""` ke transaksi.
- **Pindah kepemilikan di akun yang sama** menghasilkan transaksi `transfer` dengan `account_id = transfer_account_id`; saldo akun bersih nol (terverifikasi di test). Asal = tujuan penuh (akun dan kontak sama) ditolak.
- **Hapus dari layar** pakai `deleteThirdPartyFundEntry(db, fundId)` (atomik: detach + hapus transaksi). Hapus dari halaman Transaksi pakai `detachThirdPartyFundsForDeletedTransaction` di dalam `withTransactionAsync` yang sama dengan `DELETE FROM transactions` (belum disambung ke `app/transactions/[id]/edit.tsx`).

## Rencana urutan kerja

1. Migrasi + dokumen tabel + `classifyAccountPair` + guard `applyDebtTransaction`.
2. Logic `shared/third-party-funds/` dengan test SQLite asli (titip, ambil, oversell, transfer dua baris, edit, detach saat hapus).
3. Tipe akun di `AccountForm`/`account-types`/badge, guard picker, guard hapus akun, blokir Balance Correction.
4. Layar Dana Pihak Ketiga (ringkasan, akun, riwayat) dan entri di `more.tsx`.
5. Layar Catat Titip/Ambil, Pindah, edit baris, hapus baris.
6. Pengecualian cashflow, hapus/edit dari halaman Transaksi, lalu verifikasi di device.

Jalankan `npx tsc --noEmit` dan `npx vitest run` di `apps/mobile` sebagai baseline sebelum mulai (222 test per akhir porting investasi). Kalau `tsc` mengeluh soal route baru, itu typed routes basi: regenerasi lewat `CI=1 timeout 50 npx expo start --port 8099 --offline`, bukan bug kode.
