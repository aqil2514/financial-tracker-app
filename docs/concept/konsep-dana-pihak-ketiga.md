# Konsep Dana Pihak Ketiga di Aplikasi Ini

> Status: BARU konsep, belum ada implementasi kode apa pun. Diskusi lengkap ada di percakapan 2026-10-09 (lihat `apps/desktop/docs/todos/plan/account-type-third-party.md` untuk checklist teknisnya). Dokumen ini murni model data & aturan — belum migrasi, belum form, belum UI.

## Kenapa fitur ini ada

Secara riil, dana milik orang lain kadang nebeng tersimpan di kas/rekening pribadi — titipan tabungan, dana konsinyator yang numpang sebelum disetorkan, dan sejenisnya. Ini BUKAN kasus hipotetis: data cash opname Retailku (`thirdPartyFunds`) menunjukkan pola ini sudah terjadi nyata (contoh: "Mba-mba Kado Kuning" — Konsinyator, "Adel" — Tabungan, "Mama" — Paylater), dan saat ini di financial-app pribadi, dana semacam ini masih tercampur di akun `cash` biasa (mis. "Kantong Utama (Jago)", yang memanfaatkan fitur "pisah kantong" Bank Jago sebagai workaround manual) — tidak ada pemisahan terstruktur, sehingga total kekayaan pribadi di dashboard/laporan ikut tercampur saldo yang sebenarnya bukan milik sendiri.

`docs/concept/konsep-tipe-akun.md` (baris 25) sudah lama menyebut "Dana Pihak Ketiga" sebagai salah satu tipe akun yang "akan menyusul" — dokumen ini merumuskan modelnya secara konkret, hasil diskusi yang menguji banyak skenario nyata sebelum keputusan diambil.

## Satu akun = satu tempat fisik, BUKAN satu akun = satu penitip

Beda dari dugaan awal (satu akun per pihak, atau satu akun global menampung semua), model yang dipilih: **satu akun virtual `third_party` per TEMPAT fisik** — mengikuti grup/lokasi yang sudah ada secara alami (mis. "Kas Orang Lain" di grup Tunai, "Kas Orang Lain" di grup Bank Jago, dua akun BERBEDA walau namanya sama).

Di DALAM satu akun itu, banyak pihak bisa nitip sekaligus — dibedakan lewat `contact_id` di level data (riwayat titipan), BUKAN di level akun. Ini reuse pola yang sudah terbukti jalan untuk `debt`: satu/beberapa akun `debt`, banyak kontak dibedakan lewat `debts.contact_id`, bukan satu akun per kontak.

Alasan ini dipilih dibanding alternatif lain yang sempat dipertimbangkan:
- **Bukan "atribut di transaksi akun cash yang sudah ada"** (sempat jadi opsi utama di awal diskusi) — karena itu melanggar prinsip inti `konsep-tipe-akun.md`: "satu akun satu tipe murni" (baris 36). Kalau titipan cuma jadi flag di transaksi Kas Tunai, saldo Kas Tunai jadi tercampur lagi (sebagian pribadi, sebagian titipan) — balik ke masalah yang ingin dipecahkan.
- **Bukan "satu akun per kombinasi tempat×pihak"** — akan meledak jumlah akunnya tiap ada penitip baru di tempat baru, dan menyimpang dari pola `debt` yang justru TIDAK butuh akun per kontak.
- **Bukan "satu akun global lintas semua tempat"** — kehilangan breakdown "titipan Adel yang di Kas Tunai berapa, yang di Bank Jago berapa", yang sudah dikonfirmasi sebagai kebutuhan nyata.

## Tiga jenis pergerakan, DUA di antaranya BUKAN transfer

Berbeda dari `debt` yang mekanisme intinya lahir dari `transfer` (kas↔debt), dana pihak ketiga punya karakter berbeda: **interaksi dengan `cash` TIDAK PERNAH berupa transfer** — walau secara permukaan terlihat seperti "uang berpindah dari/ke kas", secara substansi uang itu tidak pernah benar-benar milik akun kas Aqil yang terlibat.

### 1. Titip masuk / Ambil keluar — `income`/`expense` SATU SISI pada akun `third_party`

- **Ada yang nitip** (inflow) = `income` pada akun `third_party` yang dipilih. Kontak WAJIB diisi (mirror pola `cash → debt` di `konsep-utang-piutang.md`). Uang datang dari LUAR sistem (dari pihak ketiga), BUKAN dari akun kas Aqil manapun — kas Aqil tidak pernah berkurang di peristiwa ini.
- **Ada yang ambil** (outflow) = `expense` pada akun `third_party`. Uang keluar KE LUAR sistem (ke pihak ketiga) — kas Aqil tidak pernah bertambah di peristiwa ini.

Diuji eksplisit (dan ditolak) selama diskusi: memodelkan ini sebagai `transfer cash↔third_party` — DITOLAK, karena uang yang dititipkan tidak pernah benar-benar keluar dari kas Aqil (nitip) atau masuk ke kas Aqil (ambil). `transfer` di app ini mensyaratkan dua akun yang SAMA-SAMA milik Aqil — pihak ketiga bukan "akun Aqil", jadi salah satu sisi transfer tidak pernah punya pasangan yang valid.

**Konsekuensi penting**: karena ini `income`/`expense` (bukan `transfer`), secara STRUKTUR data sama dengan transaksi pemasukan/pengeluaran biasa — tapi secara SUBSTANSI bukan pemasukan/pengeluaran Aqil sungguhan (nilai kekayaan bersih Aqil tidak berubah, karena setiap uang masuk juga menciptakan kewajiban mengembalikan sebesar itu). Karena transaksinya menempel ke akun `account_type: 'third_party'` (bukan `cash`), **pengecualian dari cashflow bisa dilakukan berdasarkan TIPE AKUN** (`WHERE account.account_type != 'third_party'`), bukan butuh flag/kolom baru di `transactions` — lebih bersih dibanding alternatif "atribut di transaksi" yang sempat dipertimbangkan di awal diskusi.

### 2. Pindah tempat dan/atau pindah kepemilikan — `transfer` ANTAR akun `third_party`

Satu-satunya kombinasi yang VALID sebagai `transfer` untuk tipe ini: **`third_party → third_party`** (boleh akun sama atau akun berbeda). Mencakup:

- **Pindah tempat fisik** — titipan Adel dipindah dari "Kas Orang Lain [Tunai]" ke "Kas Orang Lain [Bank Jago]". Kontak sisi keluar dan sisi masuk SAMA (Adel tetap Adel).
- **Pindah kepemilikan** — titipan yang tadinya atas nama Adel "dialihkan" jadi atas nama Mama (Adel bilang "itu buat Mama saja"), di akun yang SAMA. Kontak sisi keluar dan sisi masuk BERBEDA (Adel → Mama).
- **Kombinasi keduanya** — pindah tempat SEKALIGUS pindah kepemilikan dalam satu peristiwa.

Karena itu, `contact_id` sisi keluar dan sisi masuk pada transfer `third_party → third_party` **independen satu sama lain** — TIDAK dipaksa sama. Form transfer untuk kombinasi ini butuh DUA field kontak (asal, tujuan), bukan satu kontak yang dipakai bersama.

**Catatan implementasi**: `classifyAccountPair` (lihat `apps/desktop/src/shared/debts/classify-account-pair.ts`) sudah punya preseden kombinasi `debt-debt`, TAPI itu ternyata sengaja **no-op** (diklasifikasi sebagai kombinasi valid, tapi `applyDebtTransaction` tidak melakukan apa pun untuknya — "di luar scope"). Jadi `third_party-third_party` BUKAN kasus reuse logic yang sudah jadi — ini akan jadi kombinasi PERTAMA di app ini yang benar-benar mengimplementasikan efek nyata untuk transfer antar-akun-sama-tipe, perlu dirancang dari nol (walau pola arsitekturnya, yaitu `classifyAccountPair` + fungsi `apply*`, sudah matang untuk ditiru).

### 3. "Titipan jadi milik Aqil" / "ambil titipan sambil kasih upah" — DUA transaksi independen, BUKAN transfer

Diuji beberapa skenario yang awalnya terlihat seperti kandidat `third_party → cash`:

- **Ambil titipan + dapat upah sekaligus** — Adel ambil tabungannya, sambil kasih upah ke Aqil dari uang itu. INI BUKAN satu transfer — nominal titipan yang keluar dan nominal upah yang masuk adalah DUA ANGKA BERBEDA secara substansi (kebetulan terjadi bersamaan, bukan satu peristiwa). Dicatat sebagai `expense third_party` (titipan keluar) + `income cash` (upah, transaksi TERPISAH, independen).
- **Titipan diikhlaskan/dihibahkan jadi milik Aqil** — walau nilainya PERSIS sama di kedua sisi (beda dari kasus upah), ini tetap dianggap BENTUK LAIN dari "pindah kepemilikan" (poin 2), hanya saja tujuannya bukan pihak ketiga lain, melainkan Aqil sendiri. Konsisten dengan keputusan bahwa pindah kepemilikan BUKAN transfer, ini juga dicatat sebagai DUA transaksi independen: `expense third_party` (Adel, titipan keluar dari status "dititipkan") + `income cash` (Aqil, resmi jadi pemasukan).

**Kesimpulan yang diuji dari berbagai sudut dan konsisten**: `third_party` dan `cash` TIDAK PERNAH terhubung lewat SATU transaksi `transfer`, dalam skenario apa pun yang sudah diuji — baik nilainya kebetulan sama (hibah) maupun beda (upah). Yang membedakan "transfer" dari "dua transaksi independen" bukan soal apakah nilainya sama, tapi apakah ada SATU akun yang dananya benar-benar melewati dua sisi sekaligus — dan `cash` Aqil tidak pernah jadi sisi itu untuk dana pihak ketiga.

## Dikecualikan dari cashflow, TAPI saldo akun tetap apa adanya

Ini area yang perlu dibaca berdampingan dengan `konsep-tipe-akun.md` ("Laporan menampilkan angka apa adanya, bukan membuat penilaian") supaya tidak disalahpahami sebagai kontradiksi:

- **Saldo PER AKUN tetap murni dan akurat** — `accounts.balance` akun "Kas Orang Lain [Tunai]" menunjukkan persis berapa titipan yang ada di situ, TIDAK pernah tercampur dengan saldo Kas Tunai pribadi Aqil (karena memang dua akun terpisah sejak awal). Prinsip "apa adanya" dari `konsep-tipe-akun.md` tetap utuh di level ini — tidak ada penilaian yang disembunyikan, cuma dipisah akunnya.
- **Cashflow (laporan Pemasukan/Pengeluaran) MENGECUALIKAN transaksi pada akun `third_party`** — ini BUKAN soal "menyembunyikan" dana titipan dari user (user tetap bisa lihat kapan saja lewat akun "Kas Orang Lain" itu sendiri atau laporan turunan khusus dana pihak ketiga), tapi soal definisi dasar: pemasukan/pengeluaran berarti perubahan KEKAYAAN BERSIH Aqil, dan titip/ambil TIDAK PERNAH mengubah itu (setiap uang masuk menciptakan kewajiban setara untuk dikembalikan). Ini preseden PERTAMA di app ini untuk pengecualian cashflow — tapi karena dasarnya adalah TIPE AKUN (bukan flag tersebar di tiap transaksi), implementasinya tetap satu sumber kebenaran yang bersih (`WHERE account_type != 'third_party'`), bukan logic yang rawan terlewat di banyak tempat.

## Fitur turunan: "siapa titip berapa, di mana"

Kebutuhan nyata yang memicu diskusi ini: menjawab "uang orang lain di saya ada berapa? Siapa aja dan berapa aja?" — dengan breakdown PER AKUN (per tempat fisik), bukan cuma total gabungan.

Karena struktur datanya reuse pola kontak (`contact_id`) pada riwayat transaksi/baris detail akun `third_party` (pola presis sama `debts.contact_id`), pertanyaan ini terjawab lewat agregasi:

```sql
SELECT
  a.name AS tempat,
  c.name AS pihak,
  SUM(...) AS sisa_titipan  -- arah masuk - arah keluar, berdasar data turunan (lihat "Belum diputuskan")
FROM ... -- tabel detail third_party, JOIN accounts, JOIN contacts
GROUP BY a.id, c.id
HAVING sisa_titipan != 0
```

Satu query/sumber kebenaran yang sama bisa menjawab baik "total per orang" (tanpa `GROUP BY` akun) maupun "breakdown per orang × per tempat" (dengan) — tidak perlu dua struktur data berbeda.

## Belum diputuskan

- **Bentuk tabel detail** — apakah reuse pola `debts` APA ADANYA (tabel `third_party_funds` dengan kolom mirip `debts`: `contact_id`, `amount`, `account_id`, `transaction_id`, `status`), atau butuh penyesuaian karena arah pergerakannya cuma SATU arti per jenis transaksi (beda dari `debt-cash` yang AMBIGU butuh `debtAction` eksplisit — di sini `income`=nitip dan `expense`=ambil sudah jelas tanpa perlu tanya user "maksudnya apa").
- **Status "lunas"** — apakah titipan butuh konsep status eksplisit seperti `debt` (berjalan/lunas/dihapuskan), atau cukup dihitung ulang dari SUM transaksi (titipan "lunas" = saldo kontak itu di akun itu sudah 0, tidak perlu kolom status tersimpan)? Condong ke yang kedua mengingat sifatnya "rekening berjalan" tanpa titik "selesai" yang natural (beda dari piutang yang memang menuju pelunasan).
- **Validasi "ambil melebihi titipan"** — perlu validasi oversell seperti investasi (`InsufficientInvestmentUnitsError`) untuk mencegah `expense third_party` melebihi sisa titipan kontak itu di akun itu? Kemungkinan ya, pola serupa `getRemainingUnit()`.
- **Form transfer `third_party → third_party`** — detail UI untuk dua field kontak independen (asal/tujuan), termasuk bagaimana menyajikan "ini pindah tempat" vs "ini pindah kepemilikan" vs kombinasi keduanya secara jelas ke user (satu form yang sama, atau dibedakan bahasanya secara kondisional).
- **Penempatan laporan/UI** — halaman terpisah (seperti `/investments`, `/debts`) atau bagian dari halaman Akun yang sudah ada? Juga breakdown di card akun halaman Akun (lihat screenshot diskusi: perlu baris tambahan "termasuk Rp X titipan" atau cukup card akun `third_party` berdiri sendiri karena sudah akun terpisah sepenuhnya — kemungkinan BESAR opsi kedua yang relevan sekarang, karena saldo sudah terpisah bersih sejak dari struktur akunnya, bukan tercampur di satu card seperti dugaan awal diskusi).
- **Sinkronisasi ke `apps/worker`/`apps/mcp-server`** — belum dibahas sama sekali, lihat pola investasi yang sempat desktop-only dulu sebelum menyusul (`docs/todos/plan/investment-sync.md`).
- **Nama resmi tipe akun** — `third_party` dipakai konsisten sepanjang dokumen ini (sudah disebut di `konsep-tipe-akun.md`), tapi nama tabel/kolom teknis final belum diputuskan.

## Relevansi dengan Retailku

`CASH_OPNAME` Retailku sudah FINAL sebagai `generic` — `thirdPartyFunds` di sana SENGAJA tidak pernah dijurnal Retailku sendiri (dana itu memang bukan aset/liabilitas toko, lihat `apps/desktop/docs/reference/retailku-cashflow-row-classification.md`). Fitur `third_party` di financial-app ini TIDAK mengubah apa pun di sisi klasifikasi sync Retailku — murni fitur pencatatan pribadi financial-app, dipicu oleh kebutuhan nyata di luar konteks toko (titipan yang sekarang numpang di fitur "pisah kantong" Bank Jago).
