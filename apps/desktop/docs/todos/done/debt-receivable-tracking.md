# Fitur Utang Piutang: Entitas Sendiri, Bukan Sekadar Transaksi — SELESAI

## Status & TODO saat ini (ringkas)

Penjelasan lengkap kenapa tiap poin ada di sini — lihat bagian "Catatan"
dan "BELUM ditulis / batasan yang diketahui" di bawah.

- [x] Skema `debts`/`debt_payments`/`contacts` + migrasi teregistrasi.
- [x] Deteksi otomatis `debts` dari arah transfer (kas↔debt), termasuk
      FIFO multi-debt settlement.
- [x] Form transaksi: field kontak + `DebtActionField` (pelunasan/utang
      baru), validasi overpay.
- [x] 2 form khusus di halaman `/debts`: "Tambah Utang/Piutang Baru" dan
      "Bayar" per baris.
- [x] Edit transaksi dengan logic granular (blokir kalau sudah dicicil,
      recreate kalau aman).
- [x] Dialog detail kontak — scroll terkunci `85vh`, tidak lagi tumbuh
      tak terbatas saat riwayat di-expand.
- [x] `DebtListTable` — dipaginasi (SQL `LIMIT/OFFSET`), kolom aksi (`⋯`)
      dipindah ke kiri.
- [x] `DebtListTable` — filter (Status/Kontak/Akun/Status Cicilan), sort
      (Tanggal/Pokok/Sisa/Kontak/Akun), rentang tanggal via
      `PeriodPicker`, dan tombol Reset untuk mengosongkan semuanya
      sekaligus.
- [x] Aksi manual "Tandai Dihapuskan" (`written_off`) di `DebtListTable`
      — lihat catatan khusus soal saldo akun debt di bawah.
- [x] `DebtListTable` — baris bisa diklik untuk expand riwayat
      `debt_payments` langsung di tabel (`PaymentsList` diekstrak jadi
      shared component, dipakai juga di dialog detail kontak).
- [x] ~~Jatuh tempo & reminder~~ DITUTUP — diputuskan TIDAK digarap,
      lihat catatan di bawah.
- [x] Poles UI lanjutan `/debts`: empty state `DebtListTable` — beda
      pesan+icon untuk "belum ada data sama sekali" vs "tidak ada hasil
      setelah filter" (dengan tombol reset), lihat catatan di bawah.
- [x] ~~Write-off untuk `debts` dari sync Retailku (`account_id` NULL)~~
      DIPINDAH — tracking-nya sepenuhnya di
      `retailku-sync-account-type-gap.md`, bukan gap terbuka di dokumen
      ini lagi (lihat catatan di bawah).
- [x] Revert `debts.status` `'paid'` → `'ongoing'` saat edit pembayaran
      yang sebelumnya melunasi penuh — sudah diuji live, lihat catatan
      di bawah.
- [x] ~~Transfer ke akun `debt` non-personal (mis. "Modal")~~ DITUTUP —
      ternyata cuma data lama dari sebelum akun `debt` terstandarisasi,
      lihat catatan di bawah.
- [x] ~~Backfill `debt_payments` lama dengan `transaction_id IS NULL`~~
      DITUTUP — akun terkait sudah dinonaktifkan user di production,
      tidak worth effort. Gap LAIN yang lebih tepat sasaran ditemukan
      sebagai gantinya (laporan saldo tidak filter akun nonaktif), lihat
      catatan di bawah.
- [x] **BARU** Aksi cepat Edit/Hapus per baris riwayat cicilan di
      `PaymentsList` — tidak perlu lagi pindah ke halaman Transaksi,
      sudah diuji live (edit nominal in-place DAN hapus dengan revert
      status), lihat catatan di bawah.

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

- ~~Jatuh tempo & reminder — apakah masuk scope awal, atau menyusul
  setelah rangkuman dasar per kontak selesai?~~ **DITUTUP** (2026-10-04,
  sesi lanjutan) — diputuskan TIDAK perlu digarap sama sekali, bukan
  cuma ditunda. Alasan user: aplikasi ini murni catatan keuangan
  personal (bukan alat penagihan formal/bisnis), jadi fitur jatuh
  tempo/reminder dinilai tidak memberi dampak signifikan sepadan dengan
  kompleksitas yang ditambahkan (field `due_date` baru, mekanisme
  notifikasi, dst). Tidak ada rencana membuka ulang kecuali kebutuhan
  nyata muncul di pemakaian sehari-hari.
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
- ~~**BARU**: alokasi pembayaran ke tiap `debt_id` saat MULTI-piutang
  dipilih~~ **SUDAH DIJAWAB** — **FIFO** (piutang dengan `date` TERLAMA
  dilunasi duluan sampai habis/lunas, sisa nominal mengalir ke piutang
  berikutnya). User cukup pilih piutang mana saja yang mau dibayar +
  total nominal transaksi, alokasi per `debt_id` dihitung otomatis, TIDAK
  input manual per piutang.
- ~~**BARU**: `contacts` create-on-the-fly di combobox~~ **SUDAH
  DIJAWAB** (lihat "Field Nama Kontak" di atas) — warning non-blocking
  fuzzy-match (`find-similar-contacts.ts`, substring + Levenshtein ≤2),
  keputusan akhir pakai yang sudah ada / tetap buat baru diserahkan ke
  user, TIDAK ada pencegahan otomatis.
- ~~**BARU**: transaksi transfer ke akun `debt` yang BUKAN utang-piutang
  personal (ditemukan di data: "Balikin Modal", "Minjem Modal",
  "Dipinjem Cor" — lebih ke modal bisnis)~~ **DITUTUP** (2026-10-04,
  sesi lanjutan) — dicek ulang ke `finance.dev.db`: SEMUA transaksi
  "Modal"/"Cor" yang melibatkan akun `debt` ("Dipinjem Cor", "Modal air
  vit" kas→"Keluarga"; "Balikin Modal" x2 "Keluarga"→kas) adalah DATA
  LAMA dari SEBELUM akun `debt`/fitur `debts` dibangun — waktu itu akun
  "Keluarga" dipakai dgn 2 makna campur aduk (piutang-utang personal
  SEKALIGUS pos modal/kas bersama keluarga, bukan ke orang tertentu),
  makanya arah/maknanya janggal kalau diinterpretasikan pakai logic
  `applyDebtTransaction` sekarang (mis. "Dipinjem Cor" scr makna asli =
  SAYA pinjam DARI Cor, tapi arah kas->debt SELALU dibaca sistem sbg
  "piutang baru" = kebalikannya). **Dikonfirmasi user TIDAK relevan lagi
  ke depan**: di database production, praktik pencatatan SUDAH
  distandarisasi — seluruh utang-piutang personal ditampung ke SATU akun
  "Piutang" (`account_type='debt'`), tidak ada lagi pola "akun debt
  dipakai rangkap sbg pos modal". Gap ini DITUTUP sbg non-issue, bukan
  diimplementasikan — kalau pola serupa muncul lagi di masa depan
  (akun `debt` baru dipakai utk sesuatu yang bukan person-to-person),
  baru relevan dibuka ulang sbg pertanyaan desain baru.

## Deteksi otomatis debts dari transfer — keputusan implementasi (final)

Melengkapi "Update besar" di atas dengan detail yang sebelumnya belum
dijawab, khusus soal ARAH `debt → cash` (yang sebelumnya cuma disebut
"pelunasan" tanpa membahas kemungkinan itu justru UTANG baru):

1. **Kas → Debt** (uang keluar dari akun cash ke akun `debt`) — SELALU
   otomatis jadi **piutang baru** (`type='receivable'`). Tidak ada
   pilihan lain untuk arah ini — kontak (wajib) jadi `debts.contact_id`.
2. **Debt → Kas** (uang masuk dari akun `debt` ke akun cash) — arah
   transfer semata TIDAK cukup untuk tahu apakah ini pelunasan piutang
   existing atau justru UTANG baru (saya pinjam dari kontak itu) — dua
   makna berbeda, sama-sama valid secara arah uang. **User memilih
   eksplisit di form**, muncul begitu arah ini terdeteksi:
   - **"Pelunasan piutang yang sudah ada"** → lanjut ke alur multi-select
     (poin 3).
   - **"Utang baru dari kontak ini"** → langsung buat 1 baris `debts`
     baru `type='payable'`, `contact_id` dari field kontak, `amount`
     dari nominal transaksi, `transaction_id` dijejak seperti piutang.
3. **Multi-select pelunasan** — daftar pilihan HANYA menampilkan `debts`
   `status='ongoing'` MILIK KONTAK yang dipilih di field Nama Kontak
   (bukan semua kontak) — mencegah salah pilih piutang orang lain.
   Validasi: total nominal transaksi WAJIB ≤ total sisa (`amount - SUM
   (debt_payments.amount)`) dari piutang-piutang yang dicentang.
   Alokasi ke tiap `debt_id` FIFO berdasar `debts.date` TERLAMA
   (lihat poin di atas) — 1 baris `debt_payments` dibuat PER `debt_id`
   yang menerima alokasi (bukan 1 baris gabungan), masing-masing dengan
   `amount` sesuai porsi FIFO-nya, `transaction_id`/`account_id` sama
   (merujuk transaksi transfer yang sama). Status `debts` di-update
   jadi `'paid'` otomatis kalau sisa jadi 0 setelah alokasi ini.
4. **Debt ↔ Debt** (kedua akun sumber & tujuan sama-sama `account_type
   ='debt'`) — TIDAK trigger logic otomatis apa pun. Diperlakukan
   sebagai transfer biasa (field kontak tetap muncul, opsional, boleh
   diisi untuk catatan, tapi tidak ada insert ke `debts`/`debt_payments`).
   Kasus ini tidak ditemukan polanya di data nyata, di luar scope awal.

## Kredit/Paylater BUKAN bagian `account_type='debt'` — DITUNDA

Muncul pertanyaan: apakah akun kredit/paylater (Kredivo, Shopee
PayLater — grup akun "Kredit"/"Utang" di data saat ini) sebaiknya
disatukan ke `account_type='debt'` juga? **Jawaban: TIDAK, keduanya
konsep berbeda:**

- **`debt` (utang piutang, sedang dibangun)** — person-to-person, uang
  dititip/dipinjamkan ke kontak tertentu, dilacak lewat `contact_id`,
  dipicu dari ARAH TRANSFER, pelunasan = uangnya balik utuh (bukan
  cicilan berjadwal, bukan bunga).
- **Kredit/paylater** — utang ke institusi/pihak ketiga, biasanya
  berupa EXPENSE langsung (belanja pakai Kredivo = expense, bukan
  transfer dari akun kas), punya limit/jatuh tempo/cicilan terjadwal
  yang tidak cocok dengan logic "transfer kas↔debt account" atau
  validasi "bayar ≤ sisa piutang" yang sedang dirancang untuk `debt`.

**Keputusan**: `account_type` TETAP cuma `'cash'`/`'debt'` untuk
sekarang (sesuai `0013_account_type.sql`). Kredit/paylater tetap
diperlakukan sebagai akun `'cash'` biasa. Kalau nanti mau digarap,
perlu `account_type` baru (mis. `'credit'`) dengan logic terpisah
sepenuhnya dari fitur ini — TIDAK dipaksakan reuse `debts`/`debt_payments`.
Ditunda sampai fitur utang piutang personal ini selesai.

## Catatan

FITUR BARU, prioritas SUDAH ditentukan: dikerjakan lebih dulu daripada
`retailku-integration.md` (blocker jauh lebih sedikit — tidak ada
dependency sistem eksternal/auth — dan langsung menjawab pain point
personal yang sudah dikonfirmasi nyata, DIPERKUAT temuan pola nyata 70
transaksi "minjem"/"balikin" di data — bukan cuma hipotesis).

**Status implementasi saat ini** (diperbarui):

SUDAH selesai:
- Kerangka navigasi sidebar (accordion "Utang Piutang" + "Master Data").
- Migrasi `0012_debts.sql` (revisi, sudah pakai `contact_id` bukan
  `contact_name`), `0013_account_type.sql` (`accounts.account_type`
  `'cash'`/`'debt'`), `0014_transaction_contact.sql`
  (`transactions.contact_id`) — semua teregistrasi di `migrations.rs`
  dan terverifikasi.
- Fitur Kontak (`contacts`) end-to-end: CRUD lewat
  `/master-data/contacts`, rich text note, dipakai umum (bukan cuma
  debt) sesuai keputusan "Kontak sebagai entitas umum" di atas.
- Field "Tipe Akun" (`Kas/Bank` / `Utang Piutang`) di form akun — select
  dengan deskripsi kontekstual per opsi, bebas diedit create & edit.
- Field "Nama Kontak" di form transaksi — combobox creatable (bisa pilih
  existing atau ketik nama baru → otomatis jadi kontak baru saat
  submit), dengan warning fuzzy-match non-blocking (`find-similar-contacts.ts`).
  Field ini SELALU muncul (opsional untuk transaksi biasa), TAPI WAJIB
  diisi kalau akun sumber/tujuan yang dipilih `account_type='debt'` —
  tidak dibatasi ke `type='transfer'` saja (income/expense langsung ke
  akun debt juga butuh kontak).
- `resolveContactId()` (`shared/contacts/resolve-contact.ts`) — get-or-
  create dipakai dari `use-create-transaction.ts`/`use-update-transaction.ts`.
- **Logic OTOMATIS pembuatan `debts`/`debt_payments` dari transfer**
  (`shared/debts/apply-debt-transaction.ts`, dipanggil dari
  `use-create-transaction.ts` SETELAH insert transaksi, di dalam
  `mutationFn` yang sama — bukan best-effort seperti lampiran, kegagalan
  di sini membatalkan seluruh mutation):
  - Kas→Debt: `INSERT debts type='receivable'` otomatis, tidak ambigu.
  - Debt→Kas: field `DebtActionField` (`debt-action-field.tsx`) muncul
    di form, user pilih eksplisit "Pelunasan" atau "Utang baru" —
    disimpan sementara di `debt_action`/`settle_debt_ids` (field form,
    BUKAN kolom `transactions`, cuma dipakai saat submit).
  - Pelunasan: multi-select checkbox `debts` `status='ongoing'` MILIK
    KONTAK yang dipilih (`useOngoingDebts`,
    `shared/debts/use-ongoing-debts.ts`), alokasi FIFO berdasar
    `debts.date` TERLAMA (`settleDebtsFifo` di `apply-debt-transaction.ts`)
    — 1 baris `debt_payments` per `debt_id` yang menerima alokasi,
    `debts.status` di-update `'paid'` otomatis kalau sisa jadi 0.
  - Debt↔Debt: sengaja tidak trigger apa pun (sesuai keputusan di atas).
  - Diverifikasi manual lewat simulasi SQL di salinan `finance.dev.db`
    (insert receivable, lalu FIFO 2-debt settlement) — hasil sesuai
    ekspektasi, `foreign_key_check` bersih.
- **Edit transaksi TIDAK memicu ulang logic debt** — `use-update-transaction.ts`
  sengaja TIDAK memanggil `applyDebtTransaction` sama sekali (menghindari
  duplikat/inkonsistensi). `useTransactionHasDebtLink()`
  (`shared/debts/use-transaction-has-debt-link.ts`) mendeteksi transaksi
  yang SUDAH py `debts`/`debt_payments` terkait (`transaction_id` match)
  — kalau ya, field kontak & aksi debt DIKUNCI read-only di form edit
  (`debtFieldsLocked` di `transaction-form.tsx`), field lain (nominal,
  akun, dst) tetap bebas diedit.

- **Halaman `/debts`, `/debts/receivables`, `/debts/payables` — READ-ONLY,
  sengaja belum dipoles** (`features/debts/`: `ContactSummaryTable`,
  `DebtListTable`), sesuai permintaan eksplisit "cukup read only saja
  dlu, akan dipoles nanti. Hanya sekadar untuk lihat efek dari transaksi
  otomatisnya":
  - `/debts` — `ContactSummaryTable` (`use-contact-summary.ts`): per
    kontak, total sisa piutang & utang `status='ongoing'` (agregat, cuma
    kontak yang PERNAH punya `debts` yang muncul).
  - `/debts/receivables`, `/debts/payables` — `DebtListTable`
    (`use-debts-list.ts`): SEMUA `debts` per `type` (semua status, badge
    Berjalan/Lunas/Dihapuskan), kolom kontak/akun/pokok/sisa.
  - Belum ada aksi apa pun di halaman ini (tidak ada create/edit/hapus
    manual, tidak ada filter/sort) — murni untuk verifikasi visual hasil
    logic otomatis.
  - **Diverifikasi dengan data nyata** (bukan cuma simulasi SQL): transfer
    Rp1.000.000 dari akun cash ke akun "Keluarga" (`debt`) dengan kontak
    "Mama Dicky" via `tauri dev` → otomatis menghasilkan
    `debts(type='receivable', contact_id=2, amount=1000000,
    account_id=26, transaction_id=5500, status='ongoing')`, muncul benar
    di kedua halaman. Alur "Debt→Kas" (pelunasan FIFO/utang baru) BELUM
    dicoba live di `tauri dev` — baru simulasi SQL manual (lihat di atas).

- **Edit transaksi yang sudah py debts terkait — REVISI dari keputusan
  lama "TIDAK memicu ulang sama sekali"**. Keputusan lama itu digantikan
  oleh logic granular di `applyDebtTransactionEdit()`
  (`shared/debts/apply-debt-transaction.ts`), berdasar PERAN transaksi
  (`useTransactionDebtStatus()`, `shared/debts/use-transaction-debt-status.ts`)
  dan apakah "field berbahaya" (`amount`, `type`, `account_id`,
  `transfer_account_id`, `contact_id`, `debt_action`, `settle_debt_ids`)
  berubah dari nilai semula (`note`/`description`/`date`/lampiran TIDAK
  pernah dianggap berbahaya):
  - `role: 'none'` (belum pernah trigger apa pun) → jalankan
    `applyDebtTransaction` seperti create.
  - `role: 'principal'` (transaksi ini MEMBUAT sebuah `debts`), field
    berbahaya TIDAK berubah → cuma sinkronkan `debts.date`.
  - `principal`, field berbahaya berubah, `hasPayments=false` (piutang
    BELUM dicicil transaksi lain) → aman untuk RECREATE: hapus `debts`
    lama, buat ulang dari nilai baru.
  - `principal`, field berbahaya berubah, `hasPayments=true` (piutang
    SUDAH dicicil transaksi LAIN) → **DIBLOKIR** (`DebtEditBlockedError`)
    — recreate akan menghapus cicilan itu lewat `ON DELETE CASCADE`.
    UI mengunci field berbahaya (`debtFieldsLocked` di
    `transaction-form.tsx`, dengan `disabled` yang sekarang didukung
    `FormFieldCurrency`/`FormFieldCombobox`/`FormFieldToggleGroup`) —
    field aman (note/description/date/lampiran) TETAP bebas diedit.
  - `role: 'payment'` (transaksi ini SATU cicilan/pelunasan), field
    berbahaya TIDAK berubah → cuma sinkronkan `debt_payments.date`.
  - `payment`, field berbahaya berubah → SELALU aman untuk RECREATE
    (tidak ada yang bergantung pada satu baris `debt_payments`) — hapus
    baris lama, revert `debts.status` ke `'ongoing'` kalau perlu, buat
    ulang dari nilai baru.
  - Field `debt_action`/`settle_debt_ids` di form edit SELALU mulai
    KOSONG (tidak direkonstruksi dari `debt_payments` lama) — kalau
    field berbahaya diedit pada transaksi pelunasan, user wajib pilih
    ulang piutang mana yang dilunasi dari awal.
  - Diverifikasi lewat 14 unit test
    (`shared/debts/apply-debt-transaction.test.ts`, fake in-memory DB —
    bukan SQLite asli, cukup untuk menguji branching logic) DAN simulasi
    SQL manual 3 skenario kunci di salinan `finance.dev.db` (recreate
    induk belum dicicil, blokir induk sudah dicicil, recreate pelunasan).
- **Validasi overpay ditambahkan** — gap ditemukan saat menulis checklist
  manual testing: form TIDAK memvalidasi "nominal ≤ total sisa piutang
  yang dicentang" sebelum submit, padahal `settleDebtsFifo` diam-diam
  MEMBUANG kelebihan nominal (loop berhenti begitu piutang yang
  dicentang habis, sisa `remainingToAllocate` tidak pernah dipakai).
  Diperbaiki di `validateDebtFields()` (`transaction-form.tsx`) — total
  sisa dihitung dari `useOngoingDebts()` yang sudah difilter ke
  `settle_debt_ids` yang dicentang, dibandingkan ke `amount` sebelum
  submit diizinkan.
- Checklist manual testing lengkap ada di
  `docs/checklist/debt-receivable-testing.md` — cakupan: setup akun,
  create (kas→debt, debt→kas payable/settlement, partial payment, FIFO
  multi-debt, debt↔debt, expense/income langsung ke akun debt), edit
  (belum ada link, induk belum dicicil, induk sudah dicicil/harus
  diblokir, edit transaksi pelunasan itu sendiri, edit field aman saja),
  plus query SQL verifikasi cepat.

## Aksi tulis dari halaman `/debts` — "Tambah" dan "Bayar"

Muncul dari pertanyaan: transaksi transfer BIASA sudah bisa memicu
`debts` otomatis (lihat di atas) — apakah arah SEBALIKNYA juga masuk
akal, yaitu dari halaman `/debts` sendiri memicu pembuatan transaksi?
**Jawaban: ya**, konsisten dengan pola [balance-correction-dialog](../../../src/features/accounts/dialogs/balance-correction-dialog/)
yang sudah dipakai (entitas domain + transaksi otomatis sebagai jejak,
dipicu dari UI yang BUKAN form transaksi biasa) — bukan jalur data baru,
cuma titik masuk (entry point) baru ke `applyDebtTransaction` yang sama.

Diputuskan sebagai **2 form terpisah** (bukan 1 form gabungan seperti di
form transaksi), karena bentuk datanya beda:

1. **"Tambah Utang/Piutang Baru"** (`features/debts/new-debt-form/`) —
   tidak butuh referensi ke `debts` yang sudah ada sama sekali. Field:
   Jenis (Piutang/Utang, toggle group — menentukan arah transfer yang
   dibuat di baliknya), Nama Kontak, Nominal, Akun Kas, Akun Utang
   Piutang, Tanggal, Catatan. Tombol trigger di `PageHeader` (slot
   `actions`) ketiga halaman (`/debts`, `/debts/receivables`,
   `/debts/payables`) — dialog & form sama untuk ketiganya.
   - `use-create-debt.ts`: insert 1 transaksi transfer (arah dari
     `debt_type`: receivable = kas->debt, payable = debt->kas) lalu
     panggil `applyDebtTransaction` yang SAMA PERSIS dengan jalur form
     transaksi. Untuk arah payable, `debtAction` DIPAKSA `'payable'`
     (bukan ditanya lewat `DebtActionField`) karena form ini secara
     definisi selalu berarti "utang baru", tidak pernah pelunasan — itu
     tugas form "Bayar" yang terpisah.
   - Diverifikasi live di `tauri dev` (bukan cuma simulasi): 2 transaksi
     baru (piutang ke "Mama Dicky" via akun "Keluarga", utang dari "Adel"
     via akun "Tes Utang Piutang") menghasilkan baris `debts` yang benar
     DAN arah `account_id`/`transfer_account_id` transaksi sesuai
     ekspektasi (dicek lewat query SQL ke `finance.dev.db`).
2. **"Bayar"** (`features/debts/pay-debt-form/`) — SELALU menargetkan
   SATU `debts.id` spesifik yang sudah diketahui dari baris yang diklik
   (beda dari `DebtActionField` di form transaksi yang perlu checklist
   multi-pilih karena kontaknya belum tentu 1 piutang) — jadi field-nya
   lebih sedikit: Nominal, Akun Kas, Tanggal, Catatan. Dipicu per-baris
   lewat menu aksi (`ListItemActionsMenu`) di `DebtListTable`, muncul
   hanya untuk baris `status='ongoing'` — TIDAK ada tombol umum di
   `PageHeader` seperti "Tambah" karena aksi ini perlu tahu piutang/utang
   mana yang dituju.
   - `use-pay-debt.ts`: insert 1 transaksi transfer arah debt->kas lalu
     `applyDebtTransaction` dengan `debtAction: 'settlement'`,
     `settleDebtIds: [String(debt.id)]` — reuse jalur FIFO yang sama
     persis, walau kandidatnya cuma 1 debt di sini.
   - Cicilan SEBAGIAN (nominal < sisa) didukung sengaja — validasi cuma
     menolak kalau nominal MELEBIHI sisa (`debt.remaining`), konsisten
     dengan validasi overpay yang sudah ada di form transaksi.
   - Dialog dikontrol PENUH dari luar (state `payingDebt` di
     `DebtListTable`, satu instance dialog dipakai bergantian untuk
     baris mana pun) — mengikuti pola single-source-of-truth
     `AccountEditDialog` (lihat catatan di atas soal bug dialog macet)
     untuk menghindari masalah yang sama.
   - Diverifikasi live di `tauri dev`: pelunasan penuh piutang Mama Dicky
     Rp10.000 (debt id 3, via akun "Keluarga") dan utang Adel Rp15.000
     (debt id 4, via akun "Tes Utang Piutang") — keduanya menghasilkan
     transaksi transfer arah debt->kas yang benar, `debt_payments`
     tercatat dengan `transaction_id` yang sesuai, dan `debts.status`
     ikut berubah jadi `'paid'` otomatis karena nominalnya pas melunasi
     sisa (dicek lewat query SQL ke `finance.dev.db`, termasuk WAL-nya).
3. **`ContactField`** (`features/transactions/form/contact-field.tsx`)
   digeneralisasi — sebelumnya terkunci ke `Control<TransactionFormValues>`,
   sekarang generic (`Control<TFieldValues extends { contact_name: string
   | null }>`) supaya bisa dipakai ulang oleh `new-debt-form` juga, tidak
   cuma form transaksi.

BELUM ditulis / batasan yang diketahui:
- Poles UI halaman `/debts`/`receivables`/`payables` — filter status,
  aksi manual (mis. tandai `written_off`), detail per piutang (riwayat
  `debt_payments`-nya), dan style/layout yang lebih baik (saat ini murni
  `Table` polos, belum ada empty state ilustrasi dsb). Sudah TIDAK
  murni read-only lagi (lihat "Aksi tulis dari halaman /debts" di atas),
  tapi poles visual/filter di atas masih belum digarap.
  - **SUDAH dikerjakan** sebagian (bukan filter/empty state, tapi 2 gap
    konkret yang ditemukan dari pemakaian nyata):
    1. **Dialog "Detail — {kontak}"** (`features/debts-summary/content/card/detail/`)
       dulu bisa tumbuh tak terbatas tingginya tiap kali baris riwayat
       (`DebtRow`, expandable) di-expand/collapse — sekarang dikunci
       `max-h-[85vh]` dengan body scroll terpisah dari header
       (`EntityFormDialog` dapat opsi baru `scrollBody`, lihat
       `components/forms/entity-form-dialog.tsx`). Akar masalahnya
       cukup berliku: `DialogContent` dasarnya `grid`, dan constraint
       tinggi via `flex flex-col` + `ScrollArea` (`flex-1`) GAGAL
       diteruskan ke `ScrollAreaPrimitive.Viewport` (base-ui) — Viewport
       selalu auto-grow ke `scrollHeight` kontennya sendiri alih-alih
       dibatasi parent, walau computed height Root sudah benar
       (diverifikasi lewat DevTools: Root 611px tapi Viewport tetap
       902px). Fix yang akhirnya bekerja: `DialogContent` pakai
       `grid-rows-[auto_1fr]` (bukan flex) — grid row `1fr` memberi
       child height yang definite dengan cara yang lebih reliable untuk
       kasus nested percentage-height ini. Komponen `ScrollArea` global
       (dipakai 10+ tempat lain dengan tinggi fixed) TIDAK disentuh.
    2. **`DebtListTable`** (`features/debts/debt-list-table.tsx`) — tombol
       aksi (`⋯`) dipindah dari kolom PALING KANAN ke kolom PALING KIRI.
       Daftarnya sekarang DIPAGINASI di SQL (`LIMIT/OFFSET` + `COUNT(*)`,
       pola sama dengan `useAccountsPaginated`) alih-alih fetch semua
       baris sekaligus — `useDebtsList` (hook lama, fetch-semua) dipecah
       jadi `useAllDebtsList` (dipertahankan untuk `DebtsSummaryPageProvider`
       yang butuh seluruh data buat agregasi `findOldestOngoing` per
       kontak) dan `useDebtsList` baru yang paginated (dipakai
       `DebtListTable` saja, default 10 baris/halaman via
       `TablePagination` yang sudah ada).
    3. **Filter/sort/rentang tanggal** di `DebtListTable` — pakai
       infrastruktur `components/query/` yang sudah ada (bukan bangun
       baru), persis pola `useAccountsPaginated`/`AccountDetailHeader`:
       - Filter: Status, Kontak, Akun (`FilterPanel` + `buildWhereClause`,
         `allowedColumns` baru di `use-debts-list.ts`).
       - Sort: Tanggal, Pokok, Sisa (`remaining`), Kontak, Akun
         (`SortDropdown` + `buildOrderClause`) — `remaining` BUKAN kolom
         asli (alias subquery), tapi tetap valid dipakai di `ORDER BY`
         SQLite walau tidak valid dipakai di `WHERE` tanpa wrap subquery
         (beda dari kasus `balance` di `useAccountsPaginated` yang
         butuh di-wrap karena dipakai di filter, bukan cuma sort).
       - Rentang tanggal: `PeriodPicker` (BUKAN lewat `FilterPanel` tipe
         `date` — tipe itu belum diimplementasikan di UI, komponen
         `FilterDate` masih di-comment-out di `panel/content.tsx`),
         dikonsumsi lewat `extraConditions` terpisah di
         `buildWhereClause`, pola sama dengan
         `build-where-conditions.ts` milik halaman transaksi.
       - Tombol "Reset" — mengosongkan filter+sort+rentang tanggal
         sekaligus dalam satu klik, cuma muncul kalau salah satu sedang
         aktif.
    4. **Aksi "Tandai Dihapuskan" (`written_off`)** di `DebtListTable`
       (`shared/debts/use-write-off-debt.ts`) — item menu baru
       (`variant: "destructive"`) di `ListItemActionsMenu`, dipicu lewat
       `ConfirmDeleteDialog` yang sudah ada (dikontrol dari luar, sama
       pola dengan `PayDebtDialog`).

       **Bug ditemukan & diperbaiki SEBELUM dirilis** (lewat diskusi,
       bukan dari testing manual): implementasi pertama cuma `UPDATE
       debts SET status = 'written_off'`, TANPA transaksi apa pun —
       ternyata MENYALAHI `docs/concept/konsep-utang-piutang.md`
       ("Arti angka positif/negatif pada saldo akun Utang/Piutang":
       *"baik piutang maupun utang sama-sama mengarah ke nol saat
       diselesaikan"* — "Dihapuskan" termasuk salah satu dari 3 status
       yang setara "diselesaikan", sejajar dengan "Lunas"). Akibatnya:
       saldo akun `debt` (mis. "Keluarga") akan terus menumpuk setiap
       ada piutang yang di-write-off, karena `accounts.balance` di
       aplikasi ini SELALU hasil agregasi SUM dari tabel `transactions`
       (BUKAN kolom tersimpan, lihat `use-accounts.ts`) — write-off
       yang tidak membuat transaksi apa pun otomatis TIDAK PERNAH bisa
       menyentuh saldo, apa pun caranya.

       **Fix**: write-off sekarang MEMBUAT 1 transaksi `expense`
       (receivable)/`income` (payable) sebesar `debt.remaining`,
       LANGSUNG pada akun `debt` itu sendiri (BUKAN transfer ke akun
       kas — tidak ada uang riil yang diterima kembali) + 1
       `debt_payments` sebesar sisa (supaya `remaining` otomatis 0,
       sama pola dengan pelunasan penuh biasa). Pola ini SENGAJA
       konsisten dengan `correctAccountBalance` yang sudah ada (lihat
       "Koreksi saldo TIDAK menyentuh data turunan" di
       `konsep-tipe-akun.md`) — keduanya sama-sama transaksi
       `income`/`expense` "penutup" untuk penyesuaian saldo, BUKAN
       representasi uang fisik berpindah ke pihak lain saat itu juga.
       Insight yang dikonfirmasi lewat diskusi: `transactions` di
       aplikasi ini TIDAK SELALU merepresentasikan uang riil berpindah
       tangan secara fisik/digital pada momen itu — tapi tetap WAJIB
       "berkaitan dengan uang" (`type` tetap `income`/`expense`/
       `transfer`, TIDAK ada kategori transaksi "non-uang"/abstrak baru)
       supaya saldo akun (satu-satunya jalur sah mengubahnya) tetap
       akurat secara akuntansi, walau bukan representasi pergerakan
       uang fisik di momen itu.

       **Kasus `debt.account_id == null`** (data dari sync Retailku,
       lihat komentar di `use-pay-debt.ts`) — write-off DITOLAK
       (`throw Error` dengan pesan jelas, otomatis muncul di toast
       lewat `useDbMutation`), BUKAN diizinkan tanpa transaksi seperti
       semula. Alasan: tidak ada akun `debt` yang bisa "dinolkan"
       transaksinya untuk baris ini — butuh keputusan/tindak lanjut
       terpisah (lihat `retailku-sync-account-type-gap.md`), BUKAN
       jalan pintas diam-diam di sini.

       **Bug yang SAMA PERSIS ditemukan & diperbaiki sekaligus di
       tempat lain** (lewat diskusi lanjutan, bukan testing terpisah):
       pelunasan `settlement_mode: 'non_cash'` di
       `shared/debts/pay-debt-form/use-pay-debt.ts` (barter/pemutihan/
       offset, lihat `debts-sync-and-non-transfer-debts.md`) PUNYA AKAR
       MASALAH IDENTIK — awalnya `debt_payments` di-insert dengan
       `transaction_id: NULL`, TANPA transaksi apa pun, MENYALAHI
       prinsip "diselesaikan = saldo akun ke nol" yang sama. Keputusan
       lama di `debts-sync-and-non-transfer-debts.md` ("written_off
       TIDAK perlu dibangun terpisah, paid+note sudah cukup") juga ikut
       **SUPERSEDED** oleh pembangunan `written_off` di atas — lihat
       catatan revisi di dokumen itu. **Fix non_cash**: pola identik
       dengan write-off — transaksi `expense`(receivable)/
       `income`(payable) penutup LANGSUNG pada `debt.account_id`,
       KECUALI `account_id` NULL (baris sync Retailku — satu-satunya
       kasus tersisa yang tetap `transaction_id: NULL`, sama keputusan
       dengan write-off).
    5. **Filter "Status Cicilan"** (Sudah/Belum Dicicil) di
       `DebtListTable` — muncul dari pertanyaan nyata "piutang mana yang
       sudah mulai dicicil vs yang belum tersentuh sama sekali", BEDA
       dari filter Status yang sudah ada (piutang bisa `status='ongoing'`
       DAN sudah dicicil sebagian, atau `ongoing` dan belum dicicil
       sama sekali — dua potongan informasi independen). Ditangani
       TERPISAH dari `buildWhereClause` generik (`use-debts-list.ts`,
       `HAS_PAYMENTS_FILTER_KEY`) karena butuh `EXISTS`/`NOT EXISTS`
       subquery ke `debt_payments`, bukan perbandingan kolom biasa —
       filter ini di-strip dari `filters` SEBELUM diteruskan ke
       `buildWhereClause`, diterjemahkan manual jadi `extraConditions`
       (pola sama dengan `dateRangeCondition`). Tetap muncul di
       `FilterPanel` yang sama (UI konsisten), disederhanakan jadi
       binary select — operator `neq`/`is_null`/multi-value dari
       `FilterSelect` generik SENGAJA diabaikan (ambil elemen pertama
       array saja) sampai memang ada kebutuhan nyata lebih dari
       "yes"/"no".
    6. **Empty state `DebtListTable`** — sebelumnya cuma satu pesan teks
       polos ("Belum ada piutang/utang tercatat.") apa pun alasan
       kosongnya. Sekarang dibedakan dua kasus (pola sama dengan
       `contact-list.tsx`/`category-list.tsx`, satu-satunya tempat lain
       di app yang sudah bedakan "kosong beneran" vs "kosong karena
       filter"): kosong beneran (`Inbox` icon + pesan apa adanya) vs
       kosong karena `hasActiveQuery` aktif (`SearchX` icon + pesan +
       tombol "Reset filter", reuse `handleReset` yang sama dengan
       tombol Reset di toolbar). Tidak ada komponen `EmptyState`
       reusable di codebase ini — dicek dulu sebelum menulis, ternyata
       konvensi yang ada di mana pun murni `<p>` teks, jadi icon di sini
       net-new enhancement, bukan ngikut pola existing.
    7. **Riwayat `debt_payments` langsung di `DebtListTable`** — baris
       tabel sekarang bisa diklik utk expand (chevron + baris detail
       `colSpan={8}`, klik di kolom aksi `⋯` TIDAK ikut trigger expand
       lewat `stopPropagation`). `PaymentsList` (sebelumnya inline di
       `debt-row.tsx` milik dialog detail kontak) diekstrak jadi shared
       component (`shared/debts/payments-list.tsx`) supaya dipakai di
       KEDUA tempat tanpa duplikasi — `debt-row.tsx` disederhanakan
       jadi cuma pakai `PaymentsList` yang sama, tanpa perubahan
       perilaku.

## Temuan BARU (DITUTUP): data lama `debt_payments` dengan `transaction_id NULL` yang belum di-backfill — ADA di dev DAN production

Muncul dari diskusi "mau tambah aksi cepat edit/hapus cicilan langsung
di `PaymentsList`" (belum diimplementasikan) — sebelum desain, perlu tahu
dulu SEMUA bentuk `debt_payments` yang mungkin ada (lihat komentar
panjang di `use-pay-debt.ts`: satu baris bisa dari transaksi transfer
biasa, income/expense penutup langsung, ATAU `transaction_id: NULL`
tanpa transaksi apa pun sama sekali).

**Cek nyata ke database** (`docs/rules/checking-dev-database.md`):
- **Dev** (`finance.dev.db`): dari 7 baris `debt_payments`, **6 di
  antaranya `transaction_id IS NULL`** — SEMUANYA `account_id` TERISI
  (akun "Keluarga"/"Orang Lain", `account_type='debt'`), BUKAN NULL
  seperti yang dikira komentar `use-pay-debt.ts` ("satu-satunya sisa
  kasus NULL adalah sync Retailku dengan `account_id` NULL"). Beberapa
  punya `note` "Perjanjian"/"Pemutihan" — ciri khas `settlement_mode:
  'non_cash'`.
- **Production/cloud (D1, `financial-app` worker)**: dicek user langsung
  lewat Cloudflare D1 Studio — **1 dari 1** baris `debt_payments` yang
  ada JUGA `transaction_id NULL`, `account_id` mengarah ke akun
  "Keluarga" (`account_type='debt'`), `amount=2000000`. Pola IDENTIK
  dengan temuan di dev — bukan kebetulan lokal.

**Kesimpulan**: ini BUKAN cuma kasus teoretis "sync Retailku" seperti
yang disangka komentar kode — ini DATA LAMA dari SEBELUM fix non_cash
(lihat "Bug yang SAMA PERSIS ditemukan..." di atas DAN
`docs/concept/konsep-transaksi.md` "Kenapa prinsip ini sempat
dilanggar") diterapkan. Fix yang sudah ada cuma mencegah kasus BARU
(baris yang dibuat SETELAH fix selalu dapat transaksi penutup) — TIDAK
ada backfill utk baris LAMA yang terlanjur tersimpan tanpa transaksi.
Konsekuensi konkret: **saldo akun `debt` terkait (mis. "Keluarga")
kemungkinan BESAR masih menumpuk salah** (tidak pernah ikut ke nol)
untuk setiap baris lama ini — prinsip "diselesaikan = saldo ke nol" di
`konsep-utang-piutang.md` TIDAK terpenuhi untuk data historis ini,
walau SUDAH terpenuhi untuk transaksi baru sejak fix.

**BELUM diputuskan**: strategi backfill (buat transaksi penutup
retroaktif per baris NULL? berapa banyak baris ini pengaruhnya ke
laporan/saldo yg sudah dipakai user sehari-hari? perlu migrasi data atau
cukup tombol "Perbaiki" manual?) — sengaja dipisah dari task "aksi cepat
edit/hapus cicilan di `PaymentsList`" yang sedang didesain, supaya tidak
tercampur 2 concern berbeda. Akses baca `finance.db` lokal (bukan D1)
sengaja diblokir classifier Claude Code (kateg. "Production Reads") —
verifikasi lanjutan ke data produksi HARUS lewat user langsung (D1
Studio atau cara lain), bukan dari sesi otomatis.

**Penting untuk desain fitur LAIN yang bergantung pada `transaction_id`
(mis. aksi edit/hapus cicilan di `PaymentsList`, lihat di bawah): gap
`transaction_id NULL` ini TIDAK akan terus bertambah dari sini** — sudah
dicek ulang ke `use-pay-debt.ts` dan `use-write-off-debt.ts` (dua
tempat yang DULU jadi sumber bug ini):
- `useWriteOffDebt` SEKARANG SELALU membuat transaksi penutup kalau
  `debt.account_id` terisi; kalau NULL (Retailku) malah `throw Error`
  eksplisit (DITOLAK), bukan jalan pintas diam-diam yang menghasilkan
  `transaction_id: NULL`.
- `usePayDebt` cuma MASIH bisa hasilkan `transaction_id: NULL` untuk
  SATU kombinasi sempit: `debt.account_id == null` (piutang dari sync
  Retailku) **DAN** `settlement_mode: 'non_cash'` sekaligus — kombinasi
  ini SUDAH diketahui & tercatat sebagai gap terbuka terpisah ("Write-off
  untuk `debts` dari sync Retailku" di checklist atas), BUKAN bug diam-
  diam yang baru ditemukan.

Jadi baris `transaction_id NULL` yang ada SEKARANG (6 di dev, 1 di
production) adalah POPULASI TETAP peninggalan sebelum fix — tidak
bertambah dari pemakaian normal sehari-hari selama kasus Retailku+
non_cash di atas belum terjadi. Aman dijadikan dasar keputusan desain
"sembunyikan aksi edit/hapus kalau `transaction_id == null`" di
`PaymentsList` tanpa khawatir jumlahnya akan terus membengkak diam-diam.

**KEPUTUSAN AKHIR (2026-10-04, sesi lanjutan): backfill TIDAK dikerjakan.**
Dihitung dulu dampaknya biar keputusan berdasar angka, bukan tebakan:
- **Dev**: 4 baris NULL nyangkut di akun "Keluarga" (Rp2.236.243) +
  "Orang Lain" (Rp346.243) — dibandingkan saldo akun "Keluarga" saat ini
  (Rp2.232.500, dihitung pakai query SAMA PERSIS dgn `use-accounts.ts`)
  dan total piutang `ongoing` riil di akun itu (Rp34.544.826, 70 baris)
  — proporsinya kecil (~6.5%) tapi nominalnya tidak kecil.
- **Production**: user cek LANGSUNG ke D1 Studio — akun "Keluarga"
  (sumber baris NULL Rp2.000.000 itu) ternyata **`is_active = 0`**
  (dinonaktifkan user sendiri, BUKAN dihapus) sejak "mulai dengan yang
  bersih" pakai akun "Piutang" tunggal yang baru. Akun aktif sekarang:
  "Piutang" (Rp2.300.000), "Piutang Dagang" (Rp26.000), "Utang Dagang"
  (-Rp10.500) — "Keluarga"/"Bisnis"/"Orang Lain" semua nonaktif.
- **Tapi**: dicek `useAccountBalances` (`features/reports/use-account-
  balances.ts`) TERNYATA TIDAK filter `is_active` sama sekali — akun
  nonaktif tetap ikut dihitung di laporan "Saldo per Akun". Jadi gap
  Rp2 juta ini SECARA TEKNIS masih bisa nongol di laporan, walau
  akunnya sudah "dipensiunkan" dari pemakaian sehari-hari.
- **Keputusan user**: TIDAK perlu backfill — akar masalah yang lebih
  tepat sasaran BUKAN data `debt_payments`-nya (itu toh akun yang sudah
  ditinggalkan), melainkan **laporan saldo yang tidak memfilter akun
  nonaktif sama sekali** — itu gap LEBIH LUAS (berlaku utk akun nonaktif
  APA PUN, tidak terbatas ke kasus `debt`/`transaction_id NULL` ini)
  yang lebih pantas diperbaiki. "Laporan saldo nanti yang perlu
  diupdate" — dicatat sbg gap BARU terpisah di bawah, BUKAN
  diimplementasikan sesi ini.

Gap LAIN yang ditemukan selama investigasi ini (laporan saldo tidak
filter akun nonaktif) BUKAN tanggung jawab fitur utang-piutang — sudah
dipindah jadi dokumen tersendiri:
`docs/todos/plan/account-balance-report-inactive-accounts.md`.

## Aksi cepat Edit/Hapus cicilan langsung di `PaymentsList`

Muncul dari pertanyaan user: di `DebtListTable`, riwayat cicilan yang
di-expand cuma READ-ONLY — koreksi nominal atau pembatalan cicilan yang
salah input HARUS pindah ke halaman Transaksi dulu (cari transaksinya
manual), padahal konteksnya (debt mana, cicilan yang mana) sudah ada di
tangan saat itu juga.

**Keputusan desain** (setelah eksplorasi `use-pay-debt.ts` menunjukkan
1 baris `debt_payments` bisa berasal dari 4 bentuk transaksi berbeda —
lihat "Temuan BARU" di atas):
- **Edit**: dialog RINGKAS di tempat (TIDAK pindah halaman seperti pola
  lama `?edit=<id>` di `detail-tab.tsx`) — field dibatasi SENGAJA cuma
  Nominal/Tanggal/Catatan, field "berbahaya" lain (akun, tipe, kontak)
  TETAP terkunci ke nilai transaksi asli, konsisten dgn field-locking di
  `transaction-form.tsx` utk role `payment`.
- **Hapus**: `ConfirmDeleteDialog` + reuse 100% `useDeleteTransaction()`
  yang sudah ada (termasuk toast informatif "pelunasannya ikut
  dibatalkan" dari `describeDebtInfo`) — TIDAK ada mutation baru utk
  hapus, cukup pakai `payment.transaction_id`.
- **Guard WAJIB**: kedua tombol disembunyikan total kalau
  `payment.transaction_id == null` (baris lama dari sebelum fix
  non_cash, lihat "Temuan BARU" di atas) — tidak ada transaksi utk
  dituju dari baris itu. Dikonfirmasi lewat cek kode ulang: gap ini
  TIDAK akan terus bertambah (populasi tetap), aman jadi dasar guard
  permanen, bukan sekadar tempelan sementara.

**Implementasi** (`shared/debts/edit-payment-form/`: `schema.ts`,
`use-edit-payment.ts`, `edit-payment-form.tsx`, `edit-payment-dialog.tsx`,
pola sama `pay-debt-form/`):
- `useEditPayment` baca transaksi asli (`SELECT * FROM transactions
  WHERE id = $1`) di dalam `mutationFn` sendiri (bukan `useQuery`
  terpisah — hindari race baca-lalu-tulis), rekonstruksi
  `accountId`/`transferAccountId`/`contactId`/`debtAction`/
  `settleDebtIds` dari nilai transaksi asli (TIDAK pernah diisi user),
  lalu reuse PENUH `applyDebtTransactionEdit` yang sama dgn jalur edit
  transaksi biasa — termasuk logic revert `debts.status` `'paid'` ->
  `'ongoing'` yang baru saja diuji live (lihat di atas).
- `dangerousFieldsChanged` dihitung CUMA dari `amount` (konsisten dgn
  `use-update-transaction.ts`: akun/tipe/kontak tidak pernah berubah
  dari dialog ini, `date` SENGAJA tidak dianggap berbahaya sama seperti
  jalur edit transaksi biasa).
- Gap kecil ditemukan & diperbaiki SEBELUM fitur ini selesai:
  `debtPaymentsQueryKey` (dipakai `useDebtPayments`/`PaymentsList`)
  TERNYATA belum terdaftar di `QUERY_DEPENDENCIES` (`lib/query-
  dependencies.ts`) sama sekali — tanpa ini, `PaymentsList` tidak akan
  auto-refresh setelah edit/hapus. Ditambahkan ke domain `transactions`
  DAN `debts`.

**Diverifikasi live di `tauri dev` + query SQL ke `finance.dev.db`**
(bukan cuma toast UI, `docs/rules/checking-dev-database.md`):
- **Edit**: cicilan Rp60.000 (piutang "Test Piutang" Adel, sisa
  Rp40.000 sebelumnya) diedit jadi Rp20.000 lewat dialog baru —
  `debt_payments` baris baru (Rp20.000) dgn `transaction_id` SAMA
  PERSIS (update in-place pada transaksi, bukan recreate), `debts`
  tetap `ongoing` dgn sisa Rp80.000, DAN baris `transactions` ikut
  ter-`UPDATE amount=20000` — semua lewat 1 dialog, 0 navigasi halaman.
- **Hapus**: cicilan Rp20.000 yang sama dihapus lewat tombol baru —
  toast "Transaksi berhasil dihapus" + info "pelunasannya ikut
  dibatalkan" (persis sesuai `describeDebtInfo`), tabel `/debts`
  langsung menunjukkan sisa kembali Rp100.000 (pokok penuh). Dikonfirmasi
  SQL: `debt_payments` baris terkait TERHAPUS, `transactions` jejaknya
  TERHAPUS, `debts.status` tetap `ongoing` dgn `total_paid=0`.

- ~~Alur "Debt→Kas" arah "Utang baru" DAN "Pelunasan" dari FORM
  TRANSAKSI (`DebtActionField`)~~ **SUDAH DIUJI LIVE** (dikonfirmasi
  belakangan, sempat salah tercatat BELUM di draf sebelumnya) — transaksi
  5501 ("Test Transaksi Piutang", kas->debt "Tes Utang Piutang") membuat
  `debts` id 2 (`receivable`) via jalur simpel yang tidak ambigu;
  transaksi 5503 ("Cicil Pelunasan", debt "Orang Lain"->kas, Rp800.000)
  memilih **"Pelunasan"** lewat `DebtActionField` dan mengalokasikan ke
  **debt id 1** (piutang Keluarga Rp1.000.000, akun BEDA dari akun
  transaksi 5503 itu sendiri) — membuktikan combobox pemilihan piutang
  (bukan cuma deteksi arah transfer) benar-benar berfungsi.
  ~~Skenario FIFO dengan >1 piutang dicentang sekaligus~~ **JUGA SUDAH
  DIUJI LIVE**: 3 piutang `ongoing` Adel (masing-masing Rp10.000, akun
  berbeda-beda) dilunasi SEKALIGUS dalam 1 transaksi transfer Rp25.000 —
  hasilnya 3 baris `debt_payments` TERPISAH (1 per `debt_id`, sesuai
  desain) dengan `transaction_id` yang sama: 2 piutang pertama (FIFO
  berdasar `date` terlama) lunas penuh Rp10.000 masing-masing, piutang
  ke-3 cuma kebagian sisa Rp5.000 (partial, tetap `ongoing`) — total
  alokasi Rp25.000 pas sama dengan nominal transaksi, tidak ada yang
  hilang/overpay.
  ~~Jalur EDIT transaksi yang sudah py debts terkait, kasus BLOKIR
  (`principal`, `hasPayments=true`)~~ **JUGA SUDAH DIUJI LIVE**: edit
  transaksi 5510 (pembuat debt id 6 milik Adel, SUDAH lunas lewat
  cicilan dari transaksi FIFO 5512 di atas — transaksi LAIN, bukan
  dirinya sendiri) — field Tipe Transaksi/Nominal/Dari Akun/Ke
  Akun/Nama Kontak semua ter-disable di form, pesan blokir muncul
  persis seperti yang ditulis di kode
  (`"Piutang ini sudah menerima cicilan dari transaksi lain..."`),
  SEMENTARA field aman (Catatan/Deskripsi/Tanggal/Lampiran) tetap bisa
  diedit dan submit — perubahan catatan tersimpan ke `transactions.note`
  tanpa menyentuh `debts`/`debt_payments` sama sekali, dikonfirmasi
  lewat query SQL.
  - **Bug ditemukan & diperbaiki selama pengujian ini** (di luar logic
    blokir field itu sendiri, yang sudah benar): `TransactionEditDialog`
    (`features/transactions/form/transaction-edit-dialog.tsx`) punya bug
    PERSIS SAMA dengan `AccountEditDialog` yang pernah diperbaiki
    sebelumnya (lihat catatan di atas) — merender dari `open` state
    INTERNAL `useEntityForm` (bukan `controlledOpen`), dan
    `handleOpenChange` menyinkronkan DUA ARAH. Begitu submit sukses
    menutup `open` internal tanpa memberi tahu context, dialog tidak
    bisa dibuka lagi untuk transaksi manapun (ditemukan user: "Edit
    pertama bisa. Setelah simpan perubahan, buka edit, tidak bisa").
    Fix: `useUpdateTransaction` sekarang terima parameter `onSuccess`
    opsional (diteruskan ke `useEntityForm`), dan
    `TransactionEditDialog` di-rewrite mengikuti pola
    single-source-of-truth `AccountEditDialog` persis — render
    `open={isControlled ? controlledOpen : open}`, sinkron SATU ARAH
    (`controlledOpen -> open` internal), tutup eksplisit lewat
    `() => setControlledOpen?.(false)`. Diverifikasi `tsc`/`npm
    test`/`npm run build` bersih, DAN dikonfirmasi live di `tauri dev`
    — edit transaksi lagi setelah submit sebelumnya sekarang berhasil
    membuka dialog seperti biasa, bug teratasi.
- ~~Kasus RECREATE aman (`principal`, `hasPayments=false`)~~ **SUDAH
  DIUJI LIVE**: transaksi 5513 ("Tes Recreate", kas "Dompet Bebas"->debt
  "Tes Utang Piutang", kontak Adel) awalnya Rp50.000 membuat debt id 9
  (`ongoing`, 0 pembayaran) — diedit NOMINAL-nya jadi Rp75.000 (field
  berbahaya, TIDAK terkunci karena belum pernah dicicil sama sekali).
  Hasilnya: debt id 9 lama TERHAPUS SEPENUHNYA, debt id 10 baru dibuat
  dengan `amount=75000`, `transaction_id=5513` (tetap merujuk transaksi
  yang sama) — persis sesuai desain "hapus lalu buat ulang", dikonfirmasi
  lewat query SQL.
- ~~Edit transaksi PEMBAYARAN itu sendiri (`role: 'payment'`)~~ **SUDAH
  DIUJI LIVE**: transaksi 5508 ("Cicilan Terakhir", debt "Keluarga"->kas
  "Dompet Bisnis", Rp100.000, pembayaran TUNGGAL untuk debt id 1 milik
  Mama Dicky) dibuka Edit — dikonfirmasi field TIDAK PERNAH terkunci
  (beda dari kasus `principal, hasPayments=true`), termasuk
  `DebtActionField`-nya kosong/wajib dipilih ulang sesuai desain
  ("Reset ke kosong..."). Nominal diubah jadi Rp40.000 (field
  berbahaya) + pilih ulang "Pelunasan" + centang debt id 1. Hasilnya:
  `debt_payments` id 5 lama (Rp100.000) TERHAPUS SEPENUHNYA, id 9 baru
  dibuat dengan `amount=40000`, `transaction_id=5508` tetap sama — sisa
  debt id 1 BERTAMBAH kembali dari Rp100.000 jadi Rp160.000 (persis
  sesuai hitungan: total pembayaran lain Rp800.000 + Rp40.000 baru =
  Rp840.000, sisa Rp1.000.000-Rp840.000), `status` tetap `'ongoing'`.
  Confirmed benar lewat query SQL.

  ~~Revert `debts.status` dari `'paid'` balik ke `'ongoing'`~~ **SUDAH
  DIUJI LIVE** (sesi 2026-10-04 sesi ke-2): piutang baru "Test Piutang"
  Adel Rp100.000 (kas "Dompet Bebas" → debt "Bisnis") dilunasi PENUH
  Rp100.000 lewat "Bayar" → `status='paid'`, `debt_payments` 1 baris
  Rp100.000. Transaksi pelunasan itu lalu DIEDIT nominalnya turun jadi
  Rp60.000 (field berbahaya berubah, `role: 'payment'`). Hasil: baris
  `debt_payments` lama TERHAPUS, baris baru dibuat (Rp60.000, id baru),
  DAN `debts.status` berhasil revert ke `'ongoing'` dengan `remaining`
  Rp40.000 — persis sesuai desain `applyDebtTransactionEdit` (kondisi
  `amount > SUM(debt_payments)` setelah DELETE lama, sebelum INSERT
  baru). Dikonfirmasi lewat query SQL ke salinan `finance.dev.db`
  (`docs/rules/checking-dev-database.md`), bukan cuma percaya toast UI.
  Gap terakhir yang tersisa dari sub-kasus edit-pembayaran: belum ada
  yang perlu diuji lagi di area ini.

**Kesimpulan checklist edit-transaksi**: seluruh 3 role/kondisi utama
(`none` implisit dari alur create yang sudah lama teruji, `principal`
recreate-aman, `principal` blokir-karena-dicicil, `payment` recreate
bebas) SUDAH terverifikasi live. Sisa gap hanya poles UI `/debts`
(lihat di atas) dan variasi kecil revert status `paid`->`ongoing`.

## Bug ditemukan: checklist `DebtActionField` tidak menampilkan piutang
`'paid'` milik transaksi yang sedang diedit sendiri

Ditemukan user (bukan dari checklist manual) lewat pertanyaan tajam:
"Edit payment datanya ambil dari data utang piutang yang sudah dibayar.
fetch daftar hanya ambil yang belum dibayar. Jadi, sewaktu-waktu
pembayaran sudah lunas, fetch daftar bagaimana?"

**Skenario konkret**: transaksi 5507 ("Pelunasan", debt "Keluarga"->kas,
Rp10.000) melunasi debt id 3 (Mama Dicky) PENUH sampai `status='paid'`.
Kalau transaksi 5507 ini diedit (field berbahaya, mis. nominal), form
me-reset `debt_action`/`settle_debt_ids` kosong (sesuai desain), lalu
`needsDebtAction` jadi true lagi — user pilih "Pelunasan", TAPI
`useOngoingDebts` cuma filter `status='ongoing'`, jadi debt id 3 (yang
justru "milik" transaksi ini sebelumnya) **TIDAK MUNCUL** di checklist.
User terjebak: tidak bisa mencentang piutang yang sebenarnya valid untuk
dipilih ulang.

**Root cause**: backend (`applyDebtTransactionEdit`, lihat kode di
atas) SUDAH benar — `DELETE FROM debt_payments` dan revert
`debts.status` ke `'ongoing'` (kalau perlu) terjadi SEBELUM
`settleDebtsFifo` baru dijalankan saat submit. Tapi checklist di UI
di-fetch SEBELUM submit terjadi, saat `debts.status` di DB masih
`'paid'` (revert-nya baru terjadi di backend nanti) — ayam-telur murni
di sisi query UI, bukan bug logic backend.

**Fix**: `useOngoingDebts` (`shared/debts/use-ongoing-debts.ts`)
diperluas terima opsi `excludeDebtId`/`excludeTransactionId` — kalau
diisi, filter jadi `status='ongoing' OR id=excludeDebtId` (piutang
target transaksi ini SELALU disertakan apa pun statusnya), dan
`remaining` dihitung dengan MENGECUALIKAN `debt_payments` dari
`excludeTransactionId` (supaya tidak menampilkan "Sisa Rp0" yang
membingungkan — situasi SEANDAINYA pembayaran lama sudah dihapus, sesuai
apa yang akan terjadi setelah submit). `transaction-form.tsx` dan
`debt-action-field.tsx` diteruskan `transactionId`/`debtStatus` supaya
opsi ini cuma aktif saat `debtStatus.role === 'payment'` — jalur create
dan role lain tidak terpengaruh sama sekali. Diverifikasi `tsc`/`npm
test` (94/94)/`npm run build` bersih, DAN dikonfirmasi live: edit
transaksi 5507 ("Pelunasan", Rp10.000, melunasi debt id 3 sampai
`'paid'`) → pilih "Pelunasan piutang yang sudah ada" → checklist
sekarang menampilkan DUA piutang — debt id 1 (Sisa Rp160.000, ongoing,
seperti biasa) DAN debt id 3 (Sisa Rp10.000, MESKI statusnya `'paid'`
di DB) — persis nilai pokoknya, karena pembayaran Rp10.000 dari
transaksi 5507 sendiri dikecualikan dari perhitungan `remaining`.
Sebelum fix, baris debt id 3 ini tidak akan muncul sama sekali.
- ~~Cicilan SEBAGIAN (nominal < sisa) untuk "Bayar" per baris~~ **SUDAH
  DICOBA LIVE** — cicilan Rp100.000 dari sisa Rp1.000.000 piutang Mama
  Dicky (debt id 1, akun "Keluarga") menghasilkan `debt_payments` baru
  (Rp100.000, total kumulatif jadi Rp900.000) dengan `debts.status`
  TETAP `'ongoing'` (sisa Rp100.000, belum 0) — tidak salah menandai
  lunas. "Bayar" per baris (baik pelunasan penuh maupun cicilan
  sebagian, kedua arah receivable/payable) kini SEPENUHNYA terverifikasi
  live di `tauri dev`.
