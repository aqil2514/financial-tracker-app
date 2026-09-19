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

## Pertanyaan desain yang sudah dijawab

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
- **Pihak lain (kontak)** — teks bebas (`contact_name` TEXT), BUKAN
  entitas `Contact` tersendiri. Cukup untuk skala personal
  (belasan-puluhan kontak); entitas Contact terpisah bisa
  dipertimbangkan lagi kalau kebutuhannya berkembang (riwayat per
  kontak lintas fitur lain, dst).
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

## Skema database yang disepakati (belum diimplementasikan)

```sql
CREATE TABLE debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('receivable', 'payable')),
    contact_name TEXT NOT NULL,
    amount REAL NOT NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    -- jejak transaksi otomatis untuk pencairan awal
    status TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'paid', 'written_off')),
    note TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_debts_contact_name ON debts(contact_name);
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
- UI: halaman baru (`/debts`)? Card ringkasan di dashboard? Filter khusus
  di halaman akun/transaksi yang sudah ada?
- Arah transaksi otomatis per kombinasi `type` (receivable/payable) x
  aksi (pencairan/pembayaran) — mis. pencairan piutang = expense/transfer
  keluar dari akun, pembayaran piutang = income/transfer masuk — belum
  dipetakan eksplisit ke `type` transaksi (`income`/`expense`/`transfer`)
  yang akan dibuat otomatis.

## Catatan

FITUR BARU, prioritas SUDAH ditentukan: dikerjakan lebih dulu daripada
`retailku-integration.md` (blocker jauh lebih sedikit — tidak ada
dependency sistem eksternal/auth — dan langsung menjawab pain point
personal yang sudah dikonfirmasi nyata). Skema database sudah
disepakati (lihat di atas), tapi migrasi SQL-nya SENDIRI BELUM ditulis
— ini masih tahap desain, belum implementasi.
