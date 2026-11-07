# Tipe akun Valas (`forex`)

## Status & TODO saat ini (ringkas)

Konsep dan keputusan desain ada di [docs/concept/konsep-valas.md](../../../../../docs/concept/konsep-valas.md). Urutan pengerjaan: desktop dulu, lalu Worker (sync), lalu mobile — lihat bagian "Tahap" di bawah.

- [x] Konsep disepakati (2026-11-07): meniru investasi, kurs per unit, tanpa pending, transaksi langsung valas ditunda.
- [x] Keputusan: tipe akun baru `forex` dengan tabel sendiri, logic average cost dipakai bersama dari kode investasi.
- [x] Baca `apps/desktop/src/shared/investments/`: rumus average cost dan sisa unit disalin ke versi valas (bukan helper generik, SQL-nya terkunci ke nama tabel), `createAdjustmentTransaction` perlu di-export atau dipindah — lihat bagian "Temuan membaca kode investasi".
- [x] Migrasi skema desktop `0056` (CHECK `forex` + rebuild 14 tabel rantai FK) dan `0057` (tiga tabel valas), teregistrasi di `migrations.rs`, test Rust lulus (11/11), diverifikasi juga lewat perbandingan skema+data sebelum/sesudah.
- [x] Dokumen tabel [forex.md](../../tables/forex.md) dan [account.md](../../tables/account.md) diperbarui.
- [x] Tipe `forex` di kode TypeScript: `account-types.ts`, `classifyAccountPair` (`cash-forex`, `forex-cash`), form akun (negara, mata uang, kurs terkini), create/update `forex_accounts`. `tsc` bersih, vitest 310 lulus. Belum diuji manual di `tauri dev`.
- [ ] Hapus guard sementara begitu beli/jual selesai: `shared/forex/assert-forex-transaction-supported.ts` (menolak transaksi yang menyentuh akun valas), skip `forex` di `push-account-row.ts`, dan `forex` di daftar koreksi saldo yang dibatasi (`account-types.ts`) — lihat bagian "Guard sementara".
- [ ] Logic beli (transfer kas → valas) dan mode `direct`.
- [ ] Logic jual (valas → kas) dengan average cost dan Realized P/L.
- [ ] Form dan layar desktop: detail akun, beli, jual, update kurs terkini.
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

## Guard sementara (sampai beli/jual selesai)

`tsc` tidak memaksa konsumen `AccountType` menangani tipe baru, jadi tipe `forex` sudah bisa dibuat dari form akun padahal logic beli/jual belum ada. Tanpa guard, transfer kas ke akun valas jatuh diam-diam ke `createCashToCashTransfer` (tercatat sebagai transfer kas biasa tanpa riwayat unit), dan akun valas terdorong ke Worker yang CHECK `account_type`-nya belum mengenal `forex`. Penutupnya:

- Transaksi yang menyentuh akun valas ditolak eksplisit di `createTransaction` dan `updateTransaction` (`shared/forex/assert-forex-transaction-supported.ts`).
- `pushAccountRow` melewati akun `forex` (return null, sehingga `pushOnWrite` berhenti tanpa retry).
- Koreksi saldo ditolak untuk tipe `forex`, karena mengubah saldo tanpa riwayat unit.
- `applyDebtTransaction` melempar `UnsupportedAccountPairError` untuk pasangan valas, sesuai test lama yang sudah memakai `forex` sebagai contoh tipe yang tidak didukung.
- Saldo awal akun valas dipaksa 0 (modal dicatat lewat pembelian).

Belum diperiksa: `check-balance-consistency.ts`, laporan Per Tipe Akun, `cleanup-stale-domain.ts`, hapus akun, dan jalur pull sync dari Worker. Akun valas ikut terhitung di laporan sebagai tipe biasa lewat `accounts.balance`.

## Temuan membaca kode investasi

- `getAverageCostPerUnit` dan `getRemainingUnit` (`shared/investments/investment-holding-math.ts`) memakai SQL yang terkunci ke `investment_purchases`/`investment_sales` plus filter `status`. Versi valas ditulis sendiri tanpa filter status, bukan helper generik dengan nama tabel sebagai parameter.
- Pola jual dua transaksi (`apply-sell-investment-transaction.ts`) bisa dipakai apa adanya. `createAdjustmentTransaction` di dalamnya generik tapi masih private.
- Literal `'investment'` muncul di sekitar 36 file desktop (form akun, form transaksi create/update, koreksi saldo, `check-balance-consistency.ts`, laporan Per Tipe Akun, `cleanup-stale-domain.ts`). Tiap titik perlu diputuskan: ditangani valas atau dikecualikan eksplisit. Beberapa file belum dibaca isinya.

## Catatan

- Aturan yang wajib dijaga saat sentuh kode: konsep-investasi.md (jual tidak boleh oversell, balance berkurang sebesar average cost × unit, bukan nominal jual) dan prinsip bahwa migrasi `.sql` yang sudah ter-apply tidak boleh diedit.
- Saat menulis kode, komentar singkat satu baris saja, tanpa blok JSDoc panjang.
