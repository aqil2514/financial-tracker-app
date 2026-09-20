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
- **BARU**: transaksi transfer ke akun `debt` yang BUKAN utang-piutang
  personal (ditemukan di data: "Balikin Modal", "Minjem Modal",
  "Dipinjem Cor" — lebih ke modal bisnis) — apakah tetap otomatis
  dianggap `debts` (dengan kontak = nama modal/proyek), atau perlu
  pengecualian/opsi "jangan catat sebagai debt" saat submit? **BELUM
  DIJAWAB** — untuk implementasi awal, kasus ini tetap diperlakukan
  sama seperti piutang personal (kontak = nama modal/proyek yang
  diketik di field Nama Kontak), tidak ada pengecualian khusus.

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

BELUM ditulis / batasan yang diketahui:
- Poles UI halaman `/debts`/`receivables`/`payables` — filter status,
  aksi manual (mis. tandai `written_off`), detail per piutang (riwayat
  `debt_payments`-nya), dan style/layout yang lebih baik (saat ini murni
  `Table` polos, belum ada empty state ilustrasi dsb).
- Komponen `Checkbox` (`components/ui/checkbox.tsx`) baru dibuat untuk
  kebutuhan `DebtActionField` — belum dipakai di tempat lain.
- Alur "Debt→Kas" (baik "Utang baru" maupun "Pelunasan" FIFO multi-debt,
  DAN jalur edit yang baru ditambahkan) BELUM diuji lewat `tauri dev`
  secara live — cuma tervalidasi lewat simulasi SQL manual + unit test
  fake-DB. Checklist manual (`docs/checklist/debt-receivable-testing.md`)
  sudah dibuat, TAPI belum dijalankan.
