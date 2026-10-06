# Harga per unit tersimpan dengan presisi floating-point 13+ digit

Bug ditemukan saat **mengedit baris pembelian investasi** — dialog "Edit
Pembelian Investasi" menampilkan `Rp 1.311,8022851595808` di field Harga
per Unit, jelas bukan angka yang pernah diketik user secara manual.

## Bagaimana ketahuan

User curiga dari screenshot dialog edit, lalu diverifikasi langsung ke
`finance.dev.db` (lihat
[docs/rules/checking-dev-database.md](../rules/checking-dev-database.md)):

```
sqlite3 check.db "SELECT unit, price_per_unit, typeof(unit), typeof(price_per_unit) FROM investment_purchases;"

unit    price_per_unit     typeof(unit)  typeof(price_per_unit)
------  ----------------   ------------  ----------------------
7.6231  1311.80228515958   real          real
```

Nilai itu memang tersimpan persis seperti itu di DB (bukan salah tampil
di UI) — `price_per_unit` REAL dengan ~14 digit signifikan.

## Root cause

`shared/investments/price-per-unit-field.tsx` (`PricePerUnitField`) punya
toggle "Satuan"/"Total". Mode "Total" mengonversi nilai yang diketik user
(nominal total) ke per-unit dengan `parsed / unitValue`, lalu langsung
`field.onChange(...)` tanpa pembulatan — floating point division di
JavaScript nyaris selalu menghasilkan desimal berulang/panjang (mis.
`13110000 / 7.6231 = 1719.926...` dst), dan `CurrencyInput` punya
`decimalsLimit={2}` yang CUMA membatasi apa yang user bisa KETIK secara
manual — bukan nilai yang di-set lewat `onChange` terprogram dari luar.
Jadi nilai mentah hasil pembagian lolos tersimpan apa adanya ke form
state, lalu ke DB.

## Fix

Bulatkan hasil pembagian ke 2 desimal sebelum `field.onChange`:

```ts
field.onChange(Math.round((parsed / unitValue) * 100) / 100);
```

2 desimal dipilih konsisten dengan `decimalsLimit={2}` yang sudah ada di
`CurrencyInput` itu sendiri (presisi Rupiah per unit tidak butuh lebih
dari itu).

## Temuan terkait: field "Jumlah Unit" pakai koma di native number input

Screenshot yang sama menunjukkan field "Jumlah Unit" menampilkan `7,6231`
(koma) padahal komponennya native `<input type="number">`
(`FormFieldNumber`) — BUKAN bug data (value internal tetap number valid),
tapi rendering separator desimal native number input tidak konsisten
lintas browser/OS locale, dan terasa janggal berdampingan dengan field
"Harga per Unit" yang eksplisit pakai `decimalSeparator=","` (Indonesia).

Diputuskan (bukan cuma dicatat): ganti field "Jumlah Unit" dari
`FormFieldNumber` ke komponen baru `shared/investments/unit-amount-field.tsx`
(`UnitAmountField`, berbasis `react-currency-input-field` sama seperti
`PricePerUnitField`) di ketiga pemakainya — form transaksi
(`investment-fields.tsx`), form "Catat Pembelian"
(`new-investment-purchase-form.tsx`), dan dialog edit settlement
(`edit-investment-purchase-form.tsx`). `FormFieldNumber` generic sendiri
TIDAK diubah/dihapus — cuma tidak lagi dipakai untuk field unit investasi.
