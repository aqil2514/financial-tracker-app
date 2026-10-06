# Indikator "diupdate X jam lalu" salah hitung — UTC diperlakukan sebagai local time

Bug ditemukan saat **memakai fitur investasi** yang baru dibangun: indikator
staleness nilai pasar di halaman `/investments/detail` menampilkan "Nilai
Pasar Diupdate: Sekitar 7 Jam Yang Lalu" padahal baru saja diupdate lewat
tombol edit cepat beberapa menit sebelumnya.

## Bagaimana ketahuan

User curiga dari screenshot — "ini hardcode?" — lalu diverifikasi langsung
ke `finance.dev.db` (salinan ke scratchpad + file `-wal`, lihat
[docs/rules/checking-dev-database.md](../rules/checking-dev-database.md)),
bukan dipercaya dari tampilan UI saja.

## Data yang ditemukan

```
investment_accounts.updated_at = '2026-10-06 11:45:15'
```

Waktu lokal (WIB) saat dicek: `18:47` → `11:47` UTC. Selisih ASLI cuma
~2 menit, bukan 7 jam seperti yang ditampilkan.

## Root cause

`investment_accounts.updated_at` diisi dari SQLite `datetime('now')` —
selalu **UTC**. Kode di `features/investment-detail/header/investment-pl-stats.tsx`
cuma menormalisasi format (spasi → `"T"`, pola yang sama dipakai
`lib/format-date.ts`) **tanpa** suffix `"Z"` sebelum dilempar ke
`new Date(...)`. Tanpa `"Z"`, JavaScript mem-parsing string itu sebagai
**local time**, bukan UTC — jadi `new Date("2026-10-06T11:45:15")` di
runtime WIB sebenarnya merepresentasikan `11:45:15 WIB` = `04:45:15 UTC`,
7 jam LEBIH AWAL dari waktu UTC yang sebenarnya tersimpan.

`formatDistanceToNow` (date-fns) menghitung selisih ke `Date.now()` —
begitu basis waktunya geser 7 jam ke belakang, selisihnya ikut melebar 7
jam secara palsu.

**Kenapa `lib/format-date.ts` tidak kena bug yang sama** meski polanya
identik (replace spasi → T, tanpa `Z`): `format-date.ts` dipakai untuk
menampilkan tanggal/waktu **absolut** (mis. "6 Okt 2026, 18:10") — kalau
`Date` yang terbentuk salah timezone, komponen Y-M-D H:m:s yang dirender
tetap sama persis dengan yang disimpan (karena `Intl.DateTimeFormat` tanpa
override timezone merender komponen lokal dari objek `Date`, dan objek itu
dibuat dari komponen yang sama meski "label" timezone-nya salah). Bug ini
HANYA muncul saat `Date` dipakai untuk **menghitung selisih relatif ke
waktu sekarang** (`formatDistanceToNow`, dst) — di situ offset timezone
yang salah benar-benar mengubah hasil angkanya.

## Fix

Tambah suffix `"Z"` eksplisit di `investment-pl-stats.tsx`:

```ts
const updatedAgo = formatDistanceToNow(
  new Date(`${investmentAccount.updated_at.replace(" ", "T")}Z`),
  { addSuffix: true, locale: id }
);
```

`lib/format-date.ts` **TIDAK diubah** — aman untuk use-case absolutnya,
dan mengubahnya berisiko menggeser semua tanggal yang sudah benar-benar
ditampilkan di seluruh app ke arah yang salah (kebalikan dari bug ini).

## Implikasi untuk field `updated_at`/`created_at` lain

Pola yang sama (string SQLite UTC tanpa `Z`, dilempar ke `new Date()`)
kemungkinan dipakai di tempat lain untuk keperluan SELAIN tampilan
absolut — mis. kalau ada fitur "diedit X menit lalu" atau sorting
relatif-ke-sekarang di masa depan, WAJIB tambah `"Z"` eksplisit. Untuk
tampilan absolut (format-date.ts dan pemakainya), biarkan seperti sekarang.
