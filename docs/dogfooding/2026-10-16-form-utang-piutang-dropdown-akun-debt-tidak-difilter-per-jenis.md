# Form "Tambah Utang/Piutang" izinkan pilih akun debt salah kategori, saldo kas jadi salah arah saat pelunasan

Ditemukan saat dogfooding manual jalur Utang Piutang: mencurigai ada gap, dicoba reproduksi langsung di `tauri dev` sambil verifikasi tiap langkah ke `finance.dev.db` (lihat `docs/rules/checking-dev-database.md`), bukan dari membaca kode saja.

## Bagaimana ketahuan

1. Baseline saldo akun "Dompet Bebas" dicatat dari query yang sama persis dengan `useAccountBalances` (`apps/desktop/src/features/reports/use-account-balances.ts`): Rp209.865,30.
2. Dari halaman `/debts` → "Tambah Utang/Piutang", dibuat entri **Utang** baru: kontak Adel, nominal Rp10.000, catatan "Utang Baru Test". Field "Akun Utang Piutang" terisi otomatis (auto-prefill) tanpa diubah manual.
3. Dari halaman Utang, dilakukan pelunasan Rp10.000 atas utang Adel tersebut ("Pelunasan Utang"), akun kas yang dipakai: Dompet Bebas. Toast sukses, baris di tabel Utang berubah jadi status "Lunas".
4. Ekspektasi saldo Dompet Bebas setelah pelunasan: Rp209.865,30 − Rp10.000 = Rp199.865,30 (uang keluar untuk membayar utang).
5. Dicek lewat SQL: saldo aktual Dompet Bebas adalah **Rp219.865,30** — selisih +Rp20.000 dari ekspektasi, naik padahal seharusnya turun.

## Root cause

Auto-prefill akun debt di `NewDebtForm` (`apps/desktop/src/shared/debts/new-debt-form/new-debt-form.tsx`) memilih elemen pertama dari **seluruh** akun bertipe `debt` tanpa mempertimbangkan `debt_type` (receivable/payable) yang sedang aktif di form:

```ts
const debtAccounts = accounts?.filter(
  (account) => account.account_type === "debt" && account.is_active
);
// ...
useEffect(() => {
  if (!debtAccountId && debtAccounts && debtAccounts.length > 0) {
    form.setValue("debt_account_id", String(debtAccounts[0].id));
  }
}, [debtAccounts, debtAccountId]);
```

Dropdown "Akun Utang Piutang" (`debtAccountOptions`) juga dibangun dari daftar yang sama, tidak difilter — jadi user pun bisa memilih akun "Piutang" secara manual untuk entri **Utang** tanpa ada yang mencegah. Akun debt di seed/data user ada beberapa: "Piutang", "Piutang Dagang", "Utang Dagang", "Keluarga", "Orang Lain", "Bisnis" — urutan pertama kebetulan jatuh ke akun "Piutang", sehingga entri "Utang Baru Test" (payable) ter-prefill ke akun yang secara semantik untuk piutang, bukan utang.

`useCreateDebt` (`use-create-debt.ts`) lalu mengirim `debt_account_id` ini apa adanya ke `applyDebtTransaction` tanpa validasi kecocokan kategori:

```ts
const accountId = values.debt_type === "receivable" ? cashAccountId : debtAccountId;
const transferAccountId = values.debt_type === "receivable" ? debtAccountId : cashAccountId;
```

`applyDebtTransaction` (`apply-debt-transaction/create.ts`) percaya penuh pada `account_type` dari akun yang dikirim untuk menentukan `pairKind` (`classifyAccountPair`) — bukan pada `debt_type` yang dimaksud user. Karena akun "Piutang" tetap `account_type = 'debt'`, kombinasi `account_id` (debt) → `transfer_account_id` (cash) tetap lolos sebagai `pairKind: "debt-cash"` dan baris `debts` tersimpan dengan `type: 'payable'` seperti yang diminta form — TAPI `account_id` debt-nya menunjuk akun "Piutang", bukan akun utang.

Efek rantai muncul saat pelunasan: `settleDebtsFifo` (`apply-debt-transaction/settle-fifo.ts`) memakai `accountId` transaksi pelunasan sebagai nilai `debt_payments.account_id` tanpa mengecek lagi kategori akun debt yang sedang dilunasi. Karena akun "Piutang" dan akun kas (Dompet Bebas) sama-sama lolos `classifyAccountPair` sebagai pasangan debt-cash yang valid, `useAccountBalances` menghitung efek transfer ini dengan rumus `+ SUM(amount) WHERE transfer_account_id = a.id` untuk Dompet Bebas — rumus yang benar untuk **menerima** pelunasan **piutang**, tapi salah arah untuk **membayar** utang (yang seharusnya memakai cabang `- SUM(amount) WHERE account_id = a.id`, uang keluar). Root cause-nya di hulu: debt row payable ini sejak lahir sudah memakai akun debt yang salah kategori, sehingga sistem memperlakukan pelunasannya seolah-olah itu penerimaan piutang.

## Dampak

- Saldo kas jadi salah arah (naik, bukan turun) setiap kali entri Utang baru kebetulan ter-prefill atau dipilih manual ke akun debt yang semestinya untuk Piutang (atau sebaliknya) — bukan cuma salah label, tapi benar-benar mempengaruhi angka saldo yang ditampilkan ke user.
- Tidak ada error atau validasi apa pun yang muncul di UI maupun saat insert — toast selalu sukses di setiap langkah, bug hanya ketahuan dari verifikasi saldo manual lewat SQL.
- Kemungkinan sudah mempengaruhi data riil sebelum sesi ini, karena auto-prefill mengarah ke akun debt pertama tanpa mempedulikan jenisnya — mana pun entri Utang/Piutang yang dibuat tanpa mengganti akun default berisiko kena pola yang sama, tergantung urutan akun debt di daftar pengguna.
- `useOngoingDebts` dan daftar pilihan pelunasan di halaman Utang/Piutang kemungkinan juga tidak membedakan kategori akun debt saat menyusun opsi — belum diverifikasi, perlu dicek terpisah.

## Status

**BELUM DIPERBAIKI.** Baru direproduksi dan diverifikasi root cause-nya lewat database dev, perbaikan belum didesain/diimplementasikan.

## Catatan untuk ke depan

Akun bertipe `debt` di skema ini sebenarnya menaungi dua sub-kategori yang berlawanan secara akunting (piutang vs utang), tapi tidak ada kolom/metadata yang membedakannya secara eksplisit di tabel `accounts` — pembedaan murni dari nama akun yang dibaca manusia ("Piutang", "Utang Dagang", dst). Ini pola rawan yang sama kemungkinan munculnya di tempat lain mana pun akun `debt` dipakai sebagai satu kumpulan tanpa filter tambahan: perlu dicek apakah ada cara sistematis (mis. kolom `debt_direction` di `accounts`, atau convention penamaan yang divalidasi) untuk mencegah kombinasi `debt_type` form dan kategori akun debt saling bertentangan, bukan hanya mengandalkan user memilih akun yang benar secara manual.
