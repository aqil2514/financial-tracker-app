# Field "Jumlah Unit" membuang digit setelah koma (dua bug berlapis)

Bug ditemukan saat **mengedit baris pembelian investasi** (dialog "Edit
Pembelian Investasi") — user mencoba mengetik `7,6201` di field "Jumlah
Unit" (value awal `7`), tapi koma tidak pernah muncul di input sama
sekali, seolah karakter itu diabaikan. Dua bug terpisah ditemukan
berlapis di area yang sama — fix pertama memperbaiki parsing nilai
akhir, tapi memunculkan gejala kedua (paste bisa, ketik manual masih
tidak bisa, dan field jadi "beku" setelah paste) yang ternyata
penyebabnya beda sama sekali.

## Bagaimana ketahuan

User melaporkan langsung dari screenshot dialog edit saat mencoba
mengetik ulang jumlah unit dengan desimal — koma yang diketik tidak
pernah tampil, field tetap menunjukkan angka bulat.

## Root cause

`shared/investments/unit-amount-field.tsx` (`UnitAmountField`, komponen
yang justru baru diperkenalkan sebagai fix bug sebelumnya — lihat
[2026-10-06-harga-per-unit-presisi-floating-point-mentah.md](2026-10-06-harga-per-unit-presisi-floating-point-mentah.md))
memparsing nilai mentah dari `CurrencyInput` dengan `parseFloat(raw)`
JavaScript standar:

```ts
onValueChange={(raw) => field.onChange(raw ? parseFloat(raw) : null)}
```

Komponen ini di-set `decimalSeparator=","` (koma Indonesia, bukan titik)
— tapi `parseFloat` JS **tidak mengenali koma sebagai pemisah desimal
sama sekali**, ia berhenti membaca di karakter pertama yang bukan digit:

```js
parseFloat("7,6201") // => 7, BUKAN 7.6201
```

Jadi setiap kali user mengetik melewati koma, `field.onChange(7)`
dipanggil (bukan `7.6201`), form state balik ke `7`, `CurrencyInput`
re-render dengan `value={7}` — dari sudut pandang user koma itu terasa
"tidak pernah masuk", padahal sebenarnya masuk tapi langsung dibuang
tanpa indikasi error apa pun.

**Bug yang SAMA PERSIS juga ada di `price-per-unit-field.tsx`**
(`PricePerUnitField`, komponen harga yang jadi pola rujukan
`UnitAmountField`) — kemungkinan belum ketahuan sebelumnya karena harga
Rupiah per unit secara kebetulan lebih sering diketik bulat, sementara
jumlah unit (lembar reksadana dst) jauh lebih sering desimal.

## Fix

`react-currency-input-field` sudah menyediakan parameter ketiga di
`onValueChange` — `values.float` — yang merupakan nilai SUDAH
dikonversi dengan benar ke number JS standar oleh library itu sendiri,
terlepas dari `decimalSeparator` apa pun yang dipakai. Ini satu-satunya
cara aman mem-parsing nilai dari komponen ini, `parseFloat(raw)` manual
TIDAK PERNAH seharusnya dipakai berdampingan dengan `decimalSeparator`
kustom:

```ts
onValueChange={(_raw, _name, values) => field.onChange(values?.float ?? null)}
```

Diterapkan di kedua komponen (`unit-amount-field.tsx` dan
`price-per-unit-field.tsx`, yang terakhir sedikit lebih rumit karena
mode "Total" butuh nilai float sebelum pembagian `parsed / unitValue`).

## Root cause #2 (ditemukan setelah fix #1 — "paste bisa, ketik manual masih tidak bisa")

Setelah fix #1 di atas, user melaporkan: paste `7,6201` berhasil, tapi
mengetik manual karakter koma masih gagal — DAN field jadi "beku" untuk
diedit lebih lanjut setelah paste.

Kedua komponen (`UnitAmountField`, `PricePerUnitField`) memasang
`value={field.value ?? ""}` — fully controlled langsung dari angka form
state. Masalahnya: state MENTAH yang sedang diketik user, di tengah
proses (mis. `"7,"` sebelum digit desimal berikutnya diketik), TIDAK
PUNYA representasi number yang valid — `values.float` untuk string itu
adalah `null`. Begitu `field.onChange(null)` dipanggil, form state jadi
`null`, komponen re-render dengan `value=""`, dan apa pun yang sedang
diketik user hilang/ter-reset di tengah jalan. Paste "berhasil" cuma
kebetulan (kalau nilai yang di-paste langsung valid sebagai float utuh),
tapi field jadi tidak responsif lagi setelahnya karena loop re-render
yang sama terus terjadi tiap keystroke susulan.

### Fix #2

Pisahkan **state tampilan lokal** (`display`, string mentah dari
`CurrencyInput` sendiri) dari **state form** (angka final). Selama user
mengetik, `value` prop `CurrencyInput` mengikuti `display` (apa pun yang
sedang diketik, termasuk state antara yang belum valid sebagai angka) —
BUKAN `field.value` yang bisa `null` di tengah proses. `display` direset
ke `undefined` (fallback balik ke nilai final dari `field.value`) saat
`onBlur` atau (`PricePerUnitField`) saat toggle mode Satuan/Total
berubah, supaya tampilan "snap" ke nilai yang benar-benar tersimpan
begitu user selesai.

## Root cause #3 (ditemukan setelah fix #2 — mode "Total" menampilkan presisi 13 digit saat blur)

Setelah fix #2, user mengetik `Rp 10.000` di mode "Total" (unit = 7,621),
field menyimpan `price_per_unit = 1312.16` dengan benar (dibulatkan 2
desimal, fix 2026-10-06). Tapi begitu di-blur, field menampilkan balik
`Rp 9.999,971360000001` — bukan `Rp 10.000` yang diketik.

Penyebab: `computedDisplayValue` (konversi balik `field.value *
unitValue` untuk tampilan mode "Total") dihitung TANPA pembulatan —
`1312.16 * 7.621 = 9999.971360000001`, floating-point multiplication
nyaris tidak pernah menghasilkan angka bulat persis. Kelas bug yang SAMA
dengan [2026-10-06](2026-10-06-harga-per-unit-presisi-floating-point-mentah.md),
cuma titik munculnya beda (konversi TAMPILAN balik, bukan konversi
SIMPAN).

### Fix #3

Bulatkan `computedDisplayValue` ke 2 desimal juga, konsisten dengan
presisi yang sudah dipakai di jalur simpan:
`Math.round(field.value * unitValue * 100) / 100`.

**Catatan penting — selisih kecil TETAP akan muncul, ini BUKAN bug
tersisa**: `1312.16 * 7.621` dibulatkan jadi `9999.97`, bukan `10000`
persis. Ini konsekuensi matematis yang tidak terhindarkan dari keputusan
membulatkan `price_per_unit` ke 2 desimal saat disimpan (2026-10-06) —
begitu presisi aslinya dipotong di titik penyimpanan, konversi balik ke
"Total" tidak akan pernah bisa merekonstruksi nominal asli yang diketik
user 100% persis, cuma mendekati dalam rentang pembulatan 2 desimal.
Fix #3 ini menghilangkan NOISE (13 digit sampah) bukan selisihnya itu
sendiri — selisih kecil (puluhan rupiah dari ribuan/jutaan) adalah
trade-off yang sudah disadari sejak keputusan pembulatan diambil, bukan
regresi baru.

## Pelajaran

Tiga bug dogfooding berturut-turut (2026-10-06, dan dua di dokumen ini)
sama-sama berasal dari komponen `shared/investments/*-field.tsx` yang
dibungkus di atas `react-currency-input-field` — semuanya soal *cara
mengintegrasikan controlled input ini dengan React Hook Form*, bukan
soal logic bisnis investasi itu sendiri. Pola yang benar untuk input
format kustom (decimalSeparator bukan default, atau ada transformasi
sebelum simpan) adalah SELALU punya state tampilan lokal terpisah dari
state form — jangan `value={field.value}` langsung kalau nilai yang
ditampilkan dan nilai yang disimpan bisa berbeda bentuk/representasi di
tengah proses mengetik.

Sudah dicek satu pemakai `react-currency-input-field` lain di kodebase
(`components/forms/form-fields/form-field-currency.tsx`, field "Nominal"
generic yang dipakai luas) — JUGA `value={field.value}` langsung tanpa
display state terpisah, tapi AMAN karena `decimalsLimit={0}` (nominal
Rupiah tidak boleh desimal) — tidak pernah ada state "antara" yang tidak
valid sebagai integer, setiap keystroke langsung punya representasi
number yang sah. Pola bug ini HANYA muncul kalau field punya mode input
yang bisa transiently invalid (desimal dengan separator kustom, atau
konversi seperti mode "Total") — kombinasi yang cuma ada di dua field
investasi di atas.
