# Tipe akun Valas (`forex`)

## Status & TODO saat ini (ringkas)

Konsep dan keputusan desain ada di [docs/concept/konsep-valas.md](../../../../../docs/concept/konsep-valas.md). Urutan pengerjaan: desktop dulu, lalu Worker (sync), lalu mobile — lihat bagian "Tahap" di bawah.

- [x] Konsep disepakati (2026-11-07): meniru investasi, kurs per unit, tanpa pending, transaksi langsung valas ditunda.
- [x] Keputusan: tipe akun baru `forex` dengan tabel sendiri, logic average cost dipakai bersama dari kode investasi.
- [x] Baca `apps/desktop/src/shared/investments/`: rumus average cost dan sisa unit disalin ke versi valas (bukan helper generik, SQL-nya terkunci ke nama tabel), `createAdjustmentTransaction` perlu di-export atau dipindah — lihat bagian "Temuan membaca kode investasi".
- [x] Migrasi skema desktop `0056` (CHECK `forex` + rebuild 14 tabel rantai FK) dan `0057` (tiga tabel valas), teregistrasi di `migrations.rs`, test Rust lulus (11/11), diverifikasi juga lewat perbandingan skema+data sebelum/sesudah.
- [x] Dokumen tabel [forex.md](../../tables/forex.md) dan [account.md](../../tables/account.md) diperbarui.
- [x] Tipe `forex` di kode TypeScript: `account-types.ts`, `classifyAccountPair` (`cash-forex`, `forex-cash`), form akun (negara, mata uang, kurs terkini), create/update `forex_accounts`. `tsc` bersih, vitest 310 lulus. Belum diuji manual di `tauri dev`.
- [x] Guard di form transaksi utama dipasang dan DIPERTAHANKAN (beli/jual lewat dialog khusus), nasib jangka panjangnya dibahas di [transaction-form-scope.md](../../../../../docs/todos/plan/transaction-form-scope.md). Lihat bagian "Guard di form transaksi utama".
- [ ] Cabut skip `forex` di `push-account-row.ts` saat tahap sync valas selesai.
- [x] Logic beli (transfer kas → valas) dan mode `direct` (tanpa kas sumber): `shared/forex/create-forex-purchase.ts`. Nominal transaksi dihitung otomatis `unit × kurs`, tidak diinput terpisah.
- [x] Logic jual (valas → kas) dengan average cost, Realized P/L, dan validasi oversell: `shared/forex/sell-forex.ts`.
- [x] Hapus transaksi dari daftar ikut membersihkan riwayat beli/jual dan transaksi pasangannya: `shared/forex/detach-forex-for-deleted-transaction.ts`, dipasang di `use-delete-transaction.ts`.
- [x] Test dengan SQLite asli dan migrasi sungguhan (`shared/forex/forex.test.ts`, 13 kasus), bukan fake DB. Seluruh vitest lulus.
- [x] Layar Valas desktop (meniru investasi): menu "Valas" di sidebar, `/forex` (daftar kartu akun dengan jumlah, modal, nilai terkini, P/L) dan `/forex/detail?id=` (statistik, riwayat beli, riwayat jual). `tsc` bersih, belum dilihat di `tauri dev`.
- [x] Dialog khusus: catat pembelian (dari akun kas atau tanpa akun kas), jual (dengan tombol "Jual semua" dan perkiraan laba/rugi kurs), update kurs terkini.
- [x] Bug average cost ditemukan lewat cek database dev (2026-11-07) dan DIPERBAIKI: rumus awal (rata-rata atas semua pembelian) bergeser setelah jual lalu beli lagi di kurs berbeda, sehingga jual semua meninggalkan sisa balance. Kini atas posisi tersisa, dengan test regresi di `forex.test.ts`.
- [x] Dialog update nilai terkini punya toggle **Nilai total** / **Kurs** (2026-11-07, usulan dari layar Poket Valas BCA yang menampilkan Nilai IDR, bukan kurs): `shared/forex/update-rate/rate-or-total-field.tsx`, konversi di `forex-rate-math.ts` dengan test. Kartu daftar menampilkan kurs turunan. Belum dilihat di `tauri dev`.
- [ ] Form jual masih meminta kurs jual per unit. Pertimbangkan toggle serupa (nilai total rupiah yang diterima) kalau terasa janggal saat dipakai.
- [ ] Rumus average cost investasi (`investment-holding-math.ts`) kemungkinan punya masalah yang sama, TIDAK disentuh. Perlu dicek dan diputuskan terpisah, lihat bagian "Temuan membaca kode investasi".
- [ ] Tabel riwayat beli/jual belum punya aksi edit atau hapus. Koreksi lewat halaman Transaksi: hapus transaksi ikut menghapus baris riwayat, edit transaksi valas masih ditolak guard.
- [ ] Verifikasi manual di `tauri dev`, termasuk mencatat pembelian USD BCA yang sudah terjadi.
- [ ] Sync ke Worker (tabel D1 + modul sync).
- [ ] Mobile: layar khusus Valas, akun `forex` disembunyikan dari picker transaksi biasa.
- [ ] Sentuh titik rawan tipe akun (lihat [titik-rawan-tipe-akun.md](../done/titik-rawan-tipe-akun.md)): picker akun, koreksi saldo, laporan Per Tipe Akun.
- [ ] Label UI kurs terkini jelas (kurs beli bank, bukan kurs yang dibayar saat beli) — lihat konsep-valas.md.
- [ ] Tahap lanjutan, belum didesain: belanja/tarik tunai kartu debit dalam valas, tarik/setor banknotes, transfer antar akun valas (modal ikut pindah), biaya dalam valas — lihat konsep-valas.md bagian "Tahap lanjutan".

## Latar belakang

Pengguna sudah membeli USD lewat poket valas BCA dan aplikasi belum bisa mencatatnya. Hasil diskusi 2026-11-07 ada di konsep-valas.md, dokumen ini hanya memuat rencana eksekusi.

## Tahap

1. **Desktop**: skema, logic beli/jual, UI. Ini yang membuka pencatatan data nyata.
2. **Worker**: tabel D1 dan modul sync, mengikuti pola sync investasi.
3. **Mobile**: layar khusus Valas saja (beli/jual tidak lewat form transaksi umum), mengikuti pola investasi dan dana pihak ketiga mobile.

## Skema

Sudah jadi di migrasi `0056` dan `0057`. Skema final (SQL, kolom, catatan) ada di [docs/tables/forex.md](../../tables/forex.md), jangan diduplikasi di sini. Ringkasnya: `forex_accounts` (negara, mata uang, kurs terkini manual), `forex_purchases`, dan `forex_sales`, semuanya tanpa kolom `status`.

`0056` bukan migrasi kecil: karena `accounts` direferensikan banyak tabel, rebuild-nya ikut menyalin 13 tabel lain, termasuk tiga yang dibuat setelah `0049` (`debt_accounts`, `debt_amount_adjustments`, `third_party_funds`) dan kolom `transactions.is_cash_neutral`. Migrasi tipe akun berikutnya harus memakai `0056` sebagai titik acuan daftar tabel itu.

## Guard di form transaksi utama (2026-11-07: dipertahankan)

Beli dan jual valas lewat dialog khusus, bukan form transaksi utama. Karena itu guard transaksi di bawah tetap dipasang selama pertanyaan cakupan form transaksi masih terbuka, lihat [docs/todos/plan/transaction-form-scope.md](../../../../../docs/todos/plan/transaction-form-scope.md). Bagian yang benar-benar sementara hanya skip sync di `push-account-row.ts`, yang dicabut saat tahap sync valas.

Penutup yang dipasang dan alasannya:

`tsc` tidak memaksa konsumen `AccountType` menangani tipe baru, jadi tipe `forex` sudah bisa dibuat dari form akun padahal logic beli/jual belum ada. Tanpa guard, transfer kas ke akun valas jatuh diam-diam ke `createCashToCashTransfer` (tercatat sebagai transfer kas biasa tanpa riwayat unit), dan akun valas terdorong ke Worker yang CHECK `account_type`-nya belum mengenal `forex`. Penutupnya:

- Transaksi yang menyentuh akun valas ditolak eksplisit di `createTransaction` dan `updateTransaction` (`shared/forex/assert-forex-transaction-supported.ts`).
- `pushAccountRow` melewati akun `forex` (return null, sehingga `pushOnWrite` berhenti tanpa retry).
- Koreksi saldo ditolak untuk tipe `forex`, karena mengubah saldo tanpa riwayat unit.
- `applyDebtTransaction` melempar `UnsupportedAccountPairError` untuk pasangan valas, sesuai test lama yang sudah memakai `forex` sebagai contoh tipe yang tidak didukung.
- Saldo awal akun valas dipaksa 0 (modal dicatat lewat pembelian).

Belum diperiksa: `check-balance-consistency.ts`, laporan Per Tipe Akun, `cleanup-stale-domain.ts`, hapus akun, dan jalur pull sync dari Worker. Akun valas ikut terhitung di laporan sebagai tipe biasa lewat `accounts.balance`.

## Temuan membaca kode investasi

- `getAverageCostPerUnit` dan `getRemainingUnit` (`shared/investments/investment-holding-math.ts`) memakai SQL yang terkunci ke `investment_purchases`/`investment_sales` plus filter `status`. Versi valas ditulis sendiri tanpa filter status, bukan helper generik dengan nama tabel sebagai parameter.
- `getAverageCostPerUnit` investasi menghitung rata-rata atas SEMUA pembelian `settled`, tanpa mengurangi unit yang sudah terjual. Versi valas yang awalnya menyalin rumus itu terbukti salah di data dev (beli, jual sebagian, beli lagi di kurs berbeda), lalu diperbaiki menjadi atas posisi tersisa. Investasi belum diperiksa dengan skenario yang sama, belum diubah.
- Pola jual dua transaksi (`apply-sell-investment-transaction.ts`) bisa dipakai apa adanya. `createAdjustmentTransaction` di dalamnya generik tapi masih private.
- Literal `'investment'` muncul di sekitar 36 file desktop (form akun, form transaksi create/update, koreksi saldo, `check-balance-consistency.ts`, laporan Per Tipe Akun, `cleanup-stale-domain.ts`). Tiap titik perlu diputuskan: ditangani valas atau dikecualikan eksplisit. Beberapa file belum dibaca isinya.

## Catatan

- Aturan yang wajib dijaga saat sentuh kode: konsep-investasi.md (jual tidak boleh oversell, balance berkurang sebesar average cost × unit, bukan nominal jual) dan prinsip bahwa migrasi `.sql` yang sudah ter-apply tidak boleh diedit.
- Saat menulis kode, komentar singkat satu baris saja, tanpa blok JSDoc panjang.
