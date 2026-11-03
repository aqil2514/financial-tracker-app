# Handover — 2026-11-03 (sesi 1)

Sesi ini melanjutkan porting tipe akun **Investasi** desktop → mobile (`apps/mobile`) dari akhir Tahap A (lihat [handover 2026-11-02](2026-11-02-1-porting-investasi-mobile-tahap-a-selesai-pembelian-nilai-pasar-edit-hapus.md)) sampai **Tahap B selesai**: penjualan (pending dan settled), Settle, hapus penjualan pending, hapus transaksi jual, write-off unit, dan guard hapus pembelian. Hampir semuanya sudah dicoba di device fisik lewat screenshot user. Dokumen kerja [porting-account-investment.md](../../../apps/mobile/docs/todos/done/porting-account-investment.md) sudah ditutup dan dipindah ke `done/` (checklist tidak punya item `[ ]` lagi). **Porting akun investasi di mobile selesai.**

## Status git saat handover

Sudah di-commit user: `Porting penjualan investasi` (9a75335) dan `Porting writeoff` (b075b38) — keduanya sudah termasuk logic, layar, test, checkbox "Semua unit", dan perbaikan format P/L negatif.

**BELUM di-commit** (kecil, semuanya mobile/docs): pemindahan `porting-account-investment.md` dari `plan/` ke `done/` (+ judul "— SELESAI", link relatif diperbaiki, `porting-account.md` dan `docs/tables/investment.md` dan handover 2026-11-02 diperbarui tautannya), komentar guard permanen di `account-form.tsx` dan `account-picker-sheet.tsx`, pesan blokir Balance Correction di `app/accounts/[id]/edit.tsx`, dan dokumen handover ini.

## Peta kode (tambahan sejak Tahap A)

- **Logic penjualan** — `shared/investments/investment-sale.ts` (diekspor lewat `index.ts`): `recordInvestmentSale` (atomik, cek oversell, pending hanya menulis baris `investment_sales`, settled menulis leg transfer + leg penyesuaian P/L), `settleInvestmentSale`, `deletePendingInvestmentSale`, `recordInvestmentWriteOff`, `getTransactionInvestmentSale`, `detachInvestmentSaleForDeletedTransaction`, `InsufficientInvestmentUnitsError`. Test SQLite asli: `investment-sale.test.ts` (22 test).
- **Guard hapus pembelian** — `detachInvestmentPurchaseForDeletedTransaction` kini memanggil `assertPurchaseEditKeepsUnitsValid(db, row, 0, "delete")`. `InvestmentPurchaseEditBlockedError` punya parameter `action: "edit" | "delete"` supaya pesannya sesuai konteks.
- **Layar baru** (`app/investments/[id]/`): `sell.tsx`, `settle-sale.tsx`, `write-off.tsx`. Form di `features/investments/form/`: `sell-form.tsx`, `write-off-form.tsx`, `sell-all-checkbox.tsx` (dipakai kedua form), schema `sellFormSchema`/`writeOffFormSchema`/`settleSaleFormSchema` di `schema.ts`.
- **Detail** — `investment-actions.tsx` (tiga tombol aktif), `sale-row.tsx` (props `onPress`/`onSettle`/`onDelete`; baris settled yang punya transaksi bisa diketuk untuk membuka transaksinya), `InvestmentSaleRow.transactionId` ditambahkan di `investment-queries.ts`.
- **Edit/hapus transaksi** — `app/transactions/[id]/edit.tsx`: edit leg penjualan diblok dengan pesan, hapus memanggil `detachInvestmentSaleForDeletedTransaction` di dalam transaksi SQLite yang sama dan menangkap `InvestmentPurchaseEditBlockedError`.
- **Format** — `formatSignedCurrency` di `features/investments/content/pl.ts` sekarang menaruh tanda di depan Rp (`-Rp5.000`, bukan `Rp-5.000`), dengan test.

## Keputusan yang diambil user sesi ini (dan kenapa)

1. **Form Jual = layar penuh khusus**, bukan bottom sheet (field banyak, keyboard numerik rawan sempit), konsisten dengan Catat Pembelian.
2. **Jual hanya lewat layar khusus, TIDAK lewat form transaksi utama.** Akibatnya guard di picker akun form transaksi (akun investasi disembunyikan, opsi tipe Investasi disembunyikan di create-inline) **dijadikan permanen**: beli, jual, dan write-off investasi hanya lewat layar Investasi. Beda dari desktop yang menerima jual settled lewat form utama.
3. **Hapus transaksi pembelian yang unitnya sudah terjual DIBLOK** (beda dari desktop yang tidak memblok), dengan pesan khusus hapus ("Hapus dulu penjualan yang terkait…").
4. **Write-off = layar penuh sederhana** (unit, tanggal, catatan opsional; kerugian `average_cost × unit` ditampilkan otomatis, tanpa input rupiah).
5. **Checkbox "Semua unit"** di form Jual dan Write-off (permintaan user di tengah sesi): mengisi sisa unit dan mengunci kolom unit; nonaktif kalau sisa 0.
6. **Balance Correction unit ditutup tanpa diport.** Kebutuhannya sudah tercakup Catat Pembelian "Tanpa kas" (unit kurang) dan Write-off (unit berlebih), dan cabang "turun" di desktop mencatat `expense` sebesar harga × unit padahal aturan jual mengurangi saldo sebesar average cost × unit. Pesan blokir di layar edit akun kini mengarahkan ke dua alat itu. Kalau suatu saat dibutuhkan: layar kecil yang menghitung selisih lalu memanggil `recordInvestmentPurchase` (direct) atau `recordInvestmentWriteOff`.
7. **Guard "tipe akun terkunci" (`isAccountInUse`) tidak perlu diperluas**: mobile tidak punya fungsinya, tipe akun terkunci permanen di layar edit (`hideAccountTypeToggle`).

## Aturan bisnis yang dipegang (terverifikasi di device dan test)

- **Penjualan `pending` tidak membuat transaksi apa pun**; `transaction_id`, `adjustment_transaction_id`, `average_cost_per_unit`, `realized_pl` semuanya NULL sampai Settle. Unit langsung terpotong (optimis) — oversell dicek sejak pending.
- **Average cost dihitung saat settle**, bukan saat baris dibuat (test membuktikan: pembelian baru di antara pending dan settle menggeser average cost).
- **Satu penjualan settled = dua transaksi**: leg transfer `average_cost × unit` (investasi → kas) dan leg `income`/`expense` di kas sebesar `|realized_pl|` (tidak dibuat kalau 0). Dicocokkan manual di device: jual 100 unit @ Rp20.000 dengan average cost Rp5.000 → P/L +Rp1.500.000, modal turun Rp500.000.
- **Kedua leg satu kesatuan**: menghapus salah satunya menghapus baris penjualan dan leg pasangannya; mengedit salah satunya lewat form transaksi umum ditolak ("hapus lalu catat ulang dari layar Investasi"). Desktop mengizinkan edit dengan membuat ulang barisnya — ini perbedaan perilaku yang disengaja.
- **Write-off** = baris `investment_sales` dengan `price_per_unit = 0`, selalu settled, satu transaksi `expense` di akun investasi sebesar `average_cost × unit`, tanpa leg kas, `realized_pl = −kerugian`. Pembeda write-off vs jual dengan P/L nol adalah `price_per_unit = 0` (ada test negatif).
- **Nilai pasar tidak berubah otomatis saat jual**: tetap manual. Setelah jual, Unrealized P/L memakai nilai pasar lama sampai user memperbaruinya.

## Temuan / jebakan sesi ini

1. **Heredoc bash dengan banyak kutip/teks Indonesia gagal di-parse** oleh tool shell ("unexpected EOF") — tidak ada yang tertulis. Pakai tool Write atau skrip Python dari file untuk berkas besar.
2. **Tipe route Expo basi lagi** (temuan #4 handover sebelumnya) setiap menambah layar baru di `app/investments/[id]/`: `tsc` mengeluh `"/investments/[id]/sell" is not assignable`. Perbaikan yang sama: `CI=1 timeout 50 npx expo start --port 8099 --offline` lalu `npx tsc --noEmit`.
3. **Pesan penolakan hapus pembelian awalnya memakai teks jalur edit** ("Mengubah pembelian ini… Kurangi jumlah pengurangan unit") — membingungkan untuk hapus; sudah dipisah lewat parameter `action`.
4. **`formatSignedCurrency` mencetak `Rp-5.000` untuk angka negatif** (ketemu dari screenshot write-off); sudah diperbaiki dan berlaku juga untuk Unrealized P/L negatif di kartu/ringkasan.
5. **Skema `writeOffFormSchema` sempat meloloskan unit kosong** (`unitField` nullable lalu `unit as number`); sudah diberi `superRefine` wajib isi. Pola yang sama dipakai `sellFormSchema` lewat `validateUnitAndPrice(..., true, ctx)`.
6. **Pengamatan, belum diselidiki**: pemisah di baris transfer daftar Transaksi tampil sebagai "Test Akun Investasi ʼn Test Akun Kas" (juga di baris "Investasi RDPU" lama) — kemungkinan glyph panah yang tidak ter-render di font Android, bukan dari perubahan ini.
7. Kartu **"Pending vs Settled"** di detail hanya menghitung pembelian, jadi tidak ikut berkurang oleh penjualan/write-off (sama dengan desktop).
8. Penolakan oversell baru muncul setelah menekan Simpan (Alert); belum ada validasi inline di kolom unit. Checkbox "Semua unit" mengurangi kebutuhan ini.

## Verifikasi

- `npx tsc --noEmit` bersih; `npx vitest run`: **222 test lulus**, 29 berkas (naik dari 196 di akhir Tahap A).
- **Terverifikasi di device (screenshot user)**: jual pending lalu Settle; jual settled langsung (pratinjau "Kas menerima… · Realized P/L…" dan hasil akhir cocok); hapus penjualan pending; hapus transaksi jual dari halaman Transaksi (penjualan + leg pasangan hilang, modal naik kembali, Pemasukan turun sebesar leg P/L); hapus pembelian yang unitnya sudah terjual (ditolak, `-100`); oversell (ditolak, 8000 > 700); write-off 1 unit (modal 3.500.000 → 3.495.000, badge Write-off, P/L merah); format `-Rp5.000` (diperbaiki setelah dilihat).
- **BELUM dicoba di device, hanya lewat test SQLite asli**: checkbox "Semua unit" di kedua form, hapus transaksi write-off dari halaman Transaksi, pesan blokir saat menyimpan edit pada leg penjualan, mengetuk baris penjualan settled untuk membuka transaksinya, pesan hapus pembelian versi baru (teks diubah setelah screenshot), Settle ke akun kas yang berbeda dari kas pembelian.

## Belum dikerjakan / pilihan terbuka

1. **Commit** perubahan yang belum di-commit (lihat Status git).
2. **Kosmetik yang menunggu jawaban user** (ditawarkan beberapa kali, belum dijawab): (a) pemisah ribuan di field **unit** supaya "159.465" tidak terbaca sebagai desimal dan pesan oversell tidak menulis "8000" mentah; (b) pembulatan tampilan harga rata-rata (sekarang tiga desimal, mis. "Rp17.573,148"); (c) P/L bernilai nol tampil hijau "+Rp0 / +0.00%" (sama dengan desktop) — tawaran membuatnya netral.
3. **Indikator nilai pasar basi setelah ada penjualan/write-off** (ditawarkan, belum dijawab): nilai pasar manual tidak ikut berubah saat unit berkurang, jadi Unrealized P/L bisa menyesatkan.
4. **Validasi inline unit > sisa** di form Jual/Write-off (opsional, kosmetik).
5. **ESLint desktop** (temuan #7 handover sebelumnya, belum diperbaiki): `import/no-unresolved` untuk `@/lib/db` karena hanya ada config ESLint root (Expo) tanpa resolver TypeScript desktop. Opsi (a) `apps/desktop/eslint.config.js` dengan resolver ke tsconfig desktop (paling bersih), atau (b) config root diarahkan ke `apps/*/tsconfig.json`. Menunggu pilihan user; jangan jalankan lint tanpa diminta.
6. **Di luar cakupan, sengaja ditunda**: pie distribusi dan "Per Jenis Instrumen" (butuh sistem label dan chart), kolom sync + `ALTER TABLE` (mobile HARD DELETE sedangkan desktop/D1 soft delete — penjelasan belum ditulis ke `docs/tables/investment.md`), Balance Correction unit (ditutup, lihat Keputusan #6).
7. Sisa catatan lama: `DebtEditBlockedError` tampaknya tidak ditangkap di UI manapun (handover sebelumnya #6, belum diverifikasi); bottom padding layar lain (mis. daftar debt) mungkin tertutup bar navigasi Android seperti yang sudah diperbaiki di layar investasi.

## Memory yang ditulis/diupdate sesi ini

- `project_investment_dedicated_screens_only` — akun investasi permanen hanya lewat layar khusus; guard picker permanen; Balance Correction unit ditutup.

## Cara melanjutkan (saran urutan)

1. Minta user commit perubahan yang tertunda (atau tanyakan), lalu jalankan `npx vitest run` dan `npx tsc --noEmit` di `apps/mobile` untuk baseline (222 test; kalau `tsc` mengeluh soal route, lihat Temuan #2).
2. Minta user mencoba item "BELUM dicoba di device" di atas, terutama checkbox "Semua unit" dan hapus transaksi write-off.
3. Tanyakan jawaban untuk kosmetik (#2), indikator nilai pasar basi (#3), dan pilihan ESLint desktop (#5) — semuanya kecil dan berdiri sendiri.
4. Berikutnya secara roadmap: `porting-account-third-party.md` (tipe Dana Pihak Ketiga) belum dibuat — lihat [porting-account.md](../../../apps/mobile/docs/todos/done/porting-account.md). Mulai dengan riset dokumen anak seperti yang dilakukan untuk debt dan investasi, dan ingat catatan memory soal bug pull `third_party_funds` di production yang belum terselesaikan.
