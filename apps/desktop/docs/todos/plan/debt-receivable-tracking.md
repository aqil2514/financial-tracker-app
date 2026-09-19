# Fitur Utang Piutang: Entitas Sendiri, Bukan Sekadar Transaksi

## Latar belakang

Muncul dari obrolan santai (bukan permintaan implementasi) soal
diferensiasi aplikasi ini dibanding app finance manager lain yang pernah
dipakai (Money Manager). Keluhan konkretnya: di app sebelumnya, utang
piutang cuma bisa dicatat sebagai transaksi biasa (income/expense/transfer
ke akun "Piutang" — lihat akun "Aqil Frozen Food" dengan tag "Piutang" di
data saat ini) — tidak ada rangkuman "siapa berutang berapa ke saya
sekarang". Kalau ditanya orangnya langsung, harus dicatat manual lagi di
luar app karena app-nya tidak bisa diandalkan untuk menjawab itu.

## Masalah inti

Bukan soal detail pencatatan per-transaksi kurang lengkap — masalahnya
hilangnya **pandangan per-orang**. Data individual mungkin ada tersebar
sebagai transaksi, tapi tidak ada satu tempat yang menjawab "si X total
masih pinjam berapa ke saya sekarang" tanpa menjumlahkan manual.

## Arah yang sudah disepakati (level obrolan, belum desain final)

- **Entitas baru** (`debts`/piutang-utang), bukan akun virtual per orang.
  Entitas ini punya identitas & status lifecycle sendiri (siapa, jumlah,
  status: belum lunas → dicicil → lunas), terpisah dari konsep akun.
- **Tetap menggerakkan saldo akun** — setiap pencairan/cicilan/pelunasan
  membuat transaksi income/expense/transfer normal seperti biasa, mirip
  pola yang sudah dipakai di [fitur koreksi saldo akun](../../../src/features/accounts/dialogs/balance-correction-dialog/)
  (entitas domain + transaksi otomatis sebagai jejak saldo). Jadi
  `balance` akun tetap akurat tanpa perlu logic terpisah.
- **Rangkuman per kontak** adalah fitur inti yang menjawab pain point —
  bukan sistem cicilan kompleks. Lifecycle status dibutuhkan justru
  supaya rangkuman itu bisa dipercaya dari waktu ke waktu (bisa bedakan
  piutang yang masih jalan vs yang sudah lunas), bukan cuma snapshot
  transaksi mentah yang harus dijumlah ulang tiap kali dilihat.

## Update besar: dipicu OTOMATIS dari transaksi transfer, bukan form terpisah

Setelah digali lebih lanjut dengan cross-check ke data transaksi nyata,
arah desain BERUBAH SIGNIFIKAN dari draf awal di bawah — bukan lagi
"user isi form /debts khusus untuk buat piutang baru", melainkan
"transaksi transfer BIASA (yang sudah lama jadi kebiasaan) otomatis
diinterpretasikan jadi entitas `debts`".

**Temuan pola nyata di `finance.dev.db`** — dicari transaksi transfer
dengan note mengandung "minjem"/"balikin": ketemu 70 baris, semuanya ke/dari
3 akun "virtual" yang sudah dipakai bertahun-tahun untuk menampung
utang-piutang: **"Di orang lain"** (id 19), **"Keluarga"** (id 26),
**"Orang Lain"** (id 55) — persis pola akun "Piutang" yang disinggung di
"Latar belakang" di atas. Polanya SANGAT konsisten:
- **"Minjem"** (meminjamkan uang) → `account_id` = akun kas nyata,
  `transfer_account_id` = akun virtual. Uang KELUAR dari kas ke akun
  virtual.
- **"Balikin"** (orang mengembalikan) → `account_id` = akun virtual,
  `transfer_account_id` = akun kas nyata. Uang KEMBALI dari akun virtual
  ke kas.
- Nama kontak SERING berulang (Endi 13x, Mama 11x, Wayu 11x, Ayah 9x,
  Nde Salim 5x, dst) TAPI penulisannya tidak konsisten ("Mama Minjem" vs
  "mama balikin" — beda kapitalisasi) — bukti nyata kenapa "kontak
  sebagai teks bebas" (keputusan lama, lihat di bawah) sudah TIDAK
  memadai lagi begitu pola pemakaian nyata terlihat.
- Juga ketemu pola pembayaran-dengan-margin: pasangan transaksi "Kak
  Ipit Paylater" (transfer, nominal pokok PAS) + transaksi `income`
  TERPISAH "Bonus Paylater"/"Selisih Paylater" (margin/kelebihan) —
  BUKAN digabung jadi satu transfer besar. Ini pola nyata yang dipakai
  konsisten untuk kasus "bayar piutang lebih dari sisanya".

**Keputusan baru yang menggantikan/melengkapi bagian di bawah:**

1. **`accounts.account_type`** (kolom baru, lihat juga `account-type.md`
   yang membahas tipe akun secara umum) — akun bertipe `'debt'` = akun
   virtual utang-piutang (setara "Keluarga"/"Orang Lain"/"Di orang lain"
   yang sudah ada). BUKAN tabel detail 1-ke-1 seperti `credit_accounts`/
   `investment_accounts` (`account-type.md`) karena `debt` tidak punya
   atribut tambahan di level akun itu sendiri — cukup penanda tipe.
2. **Trigger dari ARAH TRANSFER, bukan parsing teks note** — TIDAK ada
   parsing kata "minjem"/"balikin" dari note (rawan typo/variasi, sudah
   terbukti di data: "Minjem"/"minjem"/"Pinjem" semua ada). Cukup lihat
   arah: uang KELUAR dari kas KE akun `debt` = piutang baru
   (`type='receivable'`). Uang MASUK dari akun `debt` KE kas = pelunasan/
   cicilan (butuh pilih `debts` mana yang dibayar, lihat poin 4).
3. **Field baru "Nama Kontak"** muncul KONDISIONAL di form transaksi,
   begitu akun tujuan/sumber yang dipilih bertipe `debt` — field
   TERPISAH dari `note` (bukan parsing note), disimpan lewat `contact_id`
   (lihat "Kontak sebagai entitas umum" di bawah, MENGGANTIKAN keputusan
   lama `contact_name` TEXT bebas).
4. **Alur "Balikin" mendukung MULTI-piutang** — combobox multi-select
   berisi daftar `debts` `status='ongoing'` untuk dipilih (bisa lebih
   dari satu piutang dibayar dalam satu transaksi transfer).
5. **Validasi nominal: WAJIB ≤ total sisa piutang yang dipilih** —
   konsisten dengan pola nyata "Kak Ipit Paylater" yang ditemukan:
   pokok piutang dan margin/kelebihan SELALU dicatat sebagai 2 transaksi
   terpisah, tidak pernah digabung. Kelebihan bayar TETAP dicatat manual
   sebagai transaksi `income`/`expense` biasa TERPISAH, DI LUAR alur
   `debts` sepenuhnya — TIDAK ada logic otomatis "sisa jadi utang
   terbalik" atau semacamnya, sengaja dijaga sesederhana kebiasaan yang
   sudah terbukti dipakai.
6. **Alokasi pembayaran ke tiap `debt_id` saat multi-piutang dipilih**
   — urutan alokasi (FIFO berdasar tanggal piutang terlama, atau
   proporsional) BELUM diputuskan, lihat "Pertanyaan yang masih belum
   dijawab" di bawah.

## Kontak sebagai entitas umum (`contacts`), BUKAN teks bebas

**Keputusan lama** (`contact_name` TEXT bebas per-`debts`) **DIGANTI**
setelah temuan pola nyata di atas menunjukkan nama kontak sering
berulang TAPI penulisannya tidak konsisten — kalau dibiarkan teks bebas,
rangkuman per kontak (tujuan inti fitur ini) akan pecah jadi baris
terpisah untuk "Mama Minjem" vs "mama balikin" padahal seharusnya 1
kontak yang sama.

Lebih jauh, kontak DISEPAKATI jadi entitas GENERAL — bukan cuma
melekat ke fitur utang-piutang. Ditemukan bukti di data yang sama: nama
kontak yang sama (Mama, Wayu, Endi) juga muncul di transaksi
income/expense BIASA yang tidak ada hubungannya dengan utang-piutang
(mis. "Dikasih mama", "Wayu Nukerin", "Wayu Margin", "Wayu TF") — kalau
`contacts` dibuat cukup general dari awal, field ini berpotensi dipakai
lintas fitur ke depan (mis. `transactions.contact_id` opsional untuk
catat "siapa yang terlibat" di transaksi biasa, bukan cuma piutang),
tanpa perlu redesain skema tiap kali ada kebutuhan baru yang melibatkan
"siapa". Cocok jadi `shared/contacts/` (pola sama seperti
`shared/attachments/`), bukan terkubur di dalam fitur debts saja.

```sql
CREATE TABLE contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_contacts_name ON contacts(name);
```

`debts.contact_name TEXT` di skema lama (bagian bawah) MENJADI
`debts.contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL` —
dipilih lewat combobox (cari & pilih existing, atau ketik nama baru yang
otomatis tersimpan sebagai `contacts` baru saat itu juga — pola
create-on-the-fly, bukan CRUD `contacts` terpisah di awal).

## Pertanyaan desain yang sudah dijawab (draf awal, sebagian SUDAH
DIGANTIKAN keputusan di atas — lihat catatan per-poin)

- **Satu kontak bisa punya banyak piutang/utang terpisah** — tiap
  transaksi pinjam baru = 1 baris `debts` baru dengan identitas &
  lifecycle sendiri, BUKAN satu saldo berjalan gabung per kontak.
  Rangkuman per kontak dihitung dengan menjumlahkan semua `debts` milik
  kontak itu saat query, bukan disimpan sebagai satu angka berjalan.
- **Cicilan** dicatat lewat tabel relasi terpisah (`debt_payments`),
  bukan self-reference di tabel yang sama — pola mirip
  invoice+payments: 1 `debts` (pokok) punya banyak `debt_payments`.
  Sisa utang/piutang = `debts.amount - SUM(debt_payments.amount)`.
- **Status "lunas"** — kolom eksplisit (`status`), bukan murni
  hasil agregasi on-the-fly. Diupdate otomatis oleh kode saat total
  pembayaran mencapai jumlah pokok, TAPI user tetap bisa override
  manual — termasuk status `written_off` untuk kasus "dihapuskan" yang
  bukan pelunasan penuh (tidak bisa ditangkap murni dari perbandingan
  SUM vs amount).
- ~~**Pihak lain (kontak)** — teks bebas (`contact_name` TEXT), BUKAN
  entitas `Contact` tersendiri.~~ **DIGANTIKAN** — lihat "Kontak sebagai
  entitas umum" di atas. Data nyata menunjukkan asumsi "skala personal,
  cukup teks bebas" ternyata salah: kontak sering berulang TAPI
  penulisannya tidak konsisten.
- **Pencairan awal JUGA transaksi otomatis** (bukan cuma cicilan) —
  konsisten penuh dengan pola 1-aksi-domain = 1-transaksi-otomatis
  (mengikuti [balance-correction-dialog](../../../src/features/accounts/dialogs/balance-correction-dialog/)).
  Karena itu tabel `debts` sendiri (bukan cuma `debt_payments`) juga
  punya kolom jejak `transaction_id`.
- **Menangani KEDUA arah** (piutang & utang) dalam SATU tabel `debts`,
  dibedakan kolom `type` (`receivable` = piutang, orang lain berutang
  ke saya; `payable` = utang, saya berutang ke orang lain) — bukan dua
  tabel terpisah, karena strukturnya identik dan cuma beda arah uang.
  Ini juga memastikan piutang & utang ke kontak yang sama (mis. pernah
  pinjam DAN pernah dipinjami oleh Budi di waktu berbeda) tidak saling
  menetralkan secara keliru saat dirangkum.

## Skema database (revisi terbaru — MIGRASI SQL BELUM DITULIS ULANG)

`0012_debts.sql` yang SUDAH ADA di `src-tauri/migrations/` masih pakai
`contact_name TEXT` (skema versi lama, di bawah ini SUDAH diupdate jadi
`contact_id` sesuai keputusan "Kontak sebagai entitas umum" di atas) —
migrasi fisiknya PERLU DITULIS ULANG/migrasi tambahan sebelum
diimplementasikan, belum dilakukan di sesi ini.

```sql
CREATE TABLE debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('receivable', 'payable')),
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    amount REAL NOT NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    -- jejak transaksi otomatis untuk pencairan awal
    status TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'paid', 'written_off')),
    note TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_debts_contact_id ON debts(contact_id);
CREATE INDEX idx_debts_status ON debts(status);

CREATE TABLE debt_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    -- jejak transaksi otomatis untuk cicilan/pelunasan ini
    note TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_debt_payments_debt ON debt_payments(debt_id);
```

`debts.account_id`/`debt_payments.account_id` disengaja terpisah —
pencairan awal dan tiap cicilan bisa lewat akun berbeda (mis. pinjamkan
tunai, dibayar balik lewat transfer bank). `ON DELETE SET NULL` (bukan
CASCADE) pada `transaction_id` di kedua tabel — kalau transaksi jejaknya
dihapus, riwayat piutang/pembayarannya tidak ikut hilang, cuma kehilangan
tautan ke transaksinya.

Kandidat kuat pemakai kolom `source`/`source_ref` general di
`transactions` (lihat `retailku-integration.md`, bagian mapping akun —
disimpulkan TIDAK relevan untuk fitur ini karena piutang/utang bukan
akun eksternal, cukup FK biasa ke `accounts` yang sudah ada) — mis.
`source = 'debt_disbursement'`/`'debt_payment'`. Kolom itu sendiri belum
dibuat di skema `transactions` saat ini.

## Pertanyaan desain yang MASIH belum dijawab

- Jatuh tempo & reminder — apakah masuk scope awal, atau menyusul setelah
  rangkuman dasar per kontak selesai?
- ~~UI: halaman baru (`/debts`)? Card ringkasan di dashboard? Filter
  khusus di halaman akun/transaksi yang sudah ada?~~ **SUDAH DIJAWAB**
  di sesi terpisah — halaman `/debts` + accordion sidebar "Utang
  Piutang" (Ringkasan Kontak/Piutang/Utang) sudah dibuat sebagai
  kerangka navigasi (placeholder, isi halaman belum dibangun) — lihat
  `app-sidebar.tsx`.
- ~~Arah transaksi otomatis per kombinasi `type` x aksi~~ **SUDAH
  DIJAWAB** — lihat "Update besar" di atas: arah ditentukan dari ARAH
  TRANSFER (kas→debt = piutang baru, debt→kas = pelunasan), bukan
  dipetakan manual per kombinasi type.
- **BARU**: alokasi pembayaran ke tiap `debt_id` saat MULTI-piutang
  dipilih dalam satu transaksi "Balikin" dan totalnya tidak habis pas di
  satu piutang saja — FIFO (piutang terlama dulu) atau proporsional
  (dibagi rata sesuai porsi masing-masing)? Atau user yang menentukan
  manual porsi tiap piutang di form?
- **BARU**: `contacts` create-on-the-fly di combobox — kalau user ketik
  nama yang MIRIP tapi tidak identik dengan kontak existing (mis. "Wayu"
  vs "Nde Wayu"), perlu mekanisme cegah duplikat (fuzzy match/suggest),
  atau dibiarkan user yang menjaga konsistensi penulisan sendiri?
- **BARU**: transaksi transfer ke akun `debt` yang BUKAN utang-piutang
  personal (ditemukan di data: "Balikin Modal", "Minjem Modal",
  "Dipinjem Cor" — lebih ke modal bisnis) — apakah tetap otomatis
  dianggap `debts` (dengan kontak = nama modal/proyek), atau perlu
  pengecualian/opsi "jangan catat sebagai debt" saat submit?

## Catatan

FITUR BARU, prioritas SUDAH ditentukan: dikerjakan lebih dulu daripada
`retailku-integration.md` (blocker jauh lebih sedikit — tidak ada
dependency sistem eksternal/auth — dan langsung menjawab pain point
personal yang sudah dikonfirmasi nyata, DIPERKUAT temuan pola nyata 70
transaksi "minjem"/"balikin" di data — bukan cuma hipotesis).

**Status implementasi saat ini**: masih tahap desain, BELUM implementasi
sama sekali kecuali kerangka navigasi sidebar (lihat di atas). Yang
BELUM ditulis: migrasi SQL final (`contacts`, `debts` versi
`contact_id`, `accounts.account_type`), logic deteksi otomatis di form
transaksi transfer, logic alokasi multi-payment. Desain skema di
`0012_debts.sql` (migrasi yang SUDAH ada di repo) SUDAH OUTDATED —
masih pakai `contact_name TEXT`, perlu migrasi tambahan atau ditulis
ulang sebelum kolom `contacts`/`contact_id` diimplementasikan.
