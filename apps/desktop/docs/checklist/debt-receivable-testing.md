# Checklist Manual Testing: Utang Piutang (Debts)

Uji coba di `tauri dev`, mengikuti logic yang didesain di
`docs/todos/plan/debt-receivable-tracking.md`. Setelah tiap langkah,
cek data aktual di DB (`finance.dev.db`) kalau hasil di UI meragukan —
lihat query contoh di akhir dokumen ini.

Siapkan dulu (kalau belum ada): minimal 1 akun `account_type='cash'`
dan 1 akun `account_type='debt'` (Master Data > Akun), dan catat
`id`-nya masing-masing untuk query verifikasi nanti.

## A. Setup akun

- [x] Buka form akun (create/edit) — field "Tipe Akun" muncul sebagai
      **Select** (bukan toggle), dengan deskripsi kontekstual di bawah
      select saat salah satu opsi dipilih ("Kas/Bank" vs "Utang Piutang").
- [x] Buat/tandai satu akun sebagai `account_type='debt'` (mis. "Test
      Piutang").

## B. Create — Kas → Debt (piutang baru, tidak ambigu)

- [x] Buat transaksi baru: Tipe **Transfer**, Dari Akun = akun cash,
      Ke Akun = akun debt.
- [x] Field **Nama Kontak** muncul, berlabel "(wajib)". Coba submit
      tanpa isi kontak → muncul error validasi, tidak tersimpan.
- [x] Isi kontak dengan nama BARU (belum pernah ada) → submit berhasil.
- [x] Cek `/master-data/contacts` — kontak baru itu otomatis muncul di
      daftar.
- [x] Cek `/debts/receivables` — muncul 1 baris baru: kontak sesuai,
      akun sesuai, pokok = sisa (belum ada cicilan), status **Berjalan**.
      Diverifikasi lewat query DB: `debts` id=1 (akun 26, Rp1.000.000)
      dan id=2 (akun 78, Rp10.000), keduanya `status='ongoing'`, belum
      ada `debt_payments`.
- [x] Cek `/debts` (Ringkasan Kontak) — kontak itu muncul dengan kolom
      "Piutang Berjalan" terisi sesuai nominal, kolom "Utang Berjalan"
      kosong (—).
- [x] Ulangi sekali lagi dengan kontak yang **sama** — pastikan TIDAK
      membuat kontak duplikat (cek `/master-data/contacts`, harus tetap
      1 baris untuk nama itu), tapi tetap membuat 2 baris `debts`
      terpisah di `/debts/receivables` (1 kontak boleh punya banyak
      piutang). Diverifikasi lewat query DB: kontak "Mama Dicky" (id=2)
      cuma 1 baris di `contacts`, dipakai di 2 baris `debts` terpisah
      (id=1 dan id=2).
- [x] Coba ketik nama kontak yang MIRIP tapi tidak identik dengan yang
      sudah ada (mis. kalau ada "Budi", ketik "Budy") — muncul warning
      kuning non-blocking di bawah field, TAPI submit tetap bisa jalan
      kalau tetap dilanjutkan (baik pilih yang mirip atau tetap buat baru).

## C. Create — Debt → Kas: Utang Baru

- [ ] Buat transaksi baru: Transfer, Dari Akun = akun debt (yang SAMA
      dengan langkah B), Ke Akun = akun cash.
- [ ] Muncul field baru di bawah Nama Kontak: **"Uang ini untuk apa?"**
      dengan 2 pilihan toggle.
- [ ] Coba submit tanpa memilih salah satu → error "Pilih dulu apakah
      ini pelunasan piutang atau utang baru".
- [ ] Pilih **"Utang baru dari kontak ini"**, isi kontak (boleh kontak
      lama atau baru), submit.
- [ ] Cek `/debts/payables` — muncul 1 baris baru: kontak sesuai, pokok
      = nominal transaksi, status **Berjalan**.
- [ ] Cek `/debts` — kolom "Utang Berjalan" untuk kontak itu terisi.

## D. Create — Debt → Kas: Pelunasan (single debt)

- [ ] Pastikan kontak dari langkah B masih punya piutang **Berjalan**
      (belum lunas) di `/debts/receivables`.
- [ ] Buat transaksi baru: Transfer, Dari Akun = akun debt, Ke Akun =
      akun cash, isi Nama Kontak dengan kontak yang SAMA seperti di
      langkah B.
- [ ] Pilih **"Pelunasan piutang yang sudah ada"** — muncul checklist
      piutang milik kontak itu (tanggal + sisa nominal per baris).
- [ ] Coba submit tanpa centang apa pun → error "Pilih minimal satu
      piutang yang dilunasi".
- [ ] Centang salah satu piutang, isi nominal PAS SAMA dengan sisa
      piutang itu, submit.
- [ ] Cek `/debts/receivables` — piutang itu sekarang berstatus **Lunas**,
      kolom Sisa = Rp0.
- [ ] Cek `/debts` — kolom "Piutang Berjalan" kontak itu berkurang
      sesuai (kalau itu satu-satunya piutang, jadi —).

## E. Create — Debt → Kas: Pelunasan sebagian (partial payment)

- [ ] Buat piutang baru (ulangi langkah B) dengan nominal, mis. Rp100.000.
- [ ] Buat transaksi pelunasan (seperti langkah D) tapi isi nominal
      LEBIH KECIL dari sisa piutang, mis. Rp40.000.
- [ ] Cek `/debts/receivables` — piutang itu TETAP **Berjalan** (belum
      lunas), kolom Sisa = Rp60.000.
- [ ] Buat transaksi pelunasan KEDUA untuk piutang yang sama, sisa
      Rp60.000 penuh — sekarang status berubah jadi **Lunas**.

## F. Create — Pelunasan multi-piutang sekaligus (FIFO)

- [ ] Buat 2 piutang BARU untuk kontak yang sama, tanggal BERBEDA (mis.
      piutang A tanggal lebih lama, nominal Rp30.000; piutang B tanggal
      lebih baru, nominal Rp50.000).
- [ ] Buat transaksi pelunasan: centang KEDUA piutang itu sekaligus,
      isi nominal Rp60.000 (lebih dari piutang A, kurang dari total A+B).
- [ ] Setelah submit, cek `/debts/receivables`:
  - [ ] Piutang A (yang tanggalnya LEBIH LAMA) harus **Lunas** duluan
        (FIFO) — menerima alokasi penuh Rp30.000.
  - [ ] Piutang B masih **Berjalan**, Sisa = Rp50.000 − (Rp60.000 −
        Rp30.000) = Rp20.000.
- [ ] Validasi batas atas: coba lagi dengan nominal transaksi LEBIH
      BESAR dari total sisa piutang yang dicentang — submit harus
      DITOLAK dengan error "Nominal melebihi total sisa piutang yang
      dipilih — catat kelebihannya sebagai transaksi terpisah" (sesuai
      pola "Kak Ipit Paylater" di dokumen desain: kelebihan bayar dicatat
      MANUAL sebagai transaksi terpisah, bukan otomatis).

## G. Create — Debt ↔ Debt (di luar scope, tidak trigger apa pun)

- [ ] Buat 2 akun `account_type='debt'` kalau belum ada.
- [ ] Buat transaksi transfer ANTARA kedua akun debt itu.
- [ ] Field Nama Kontak tetap muncul (opsional, boleh dikosongi), TAPI
      **tidak ada** field "Uang ini untuk apa?" yang muncul.
- [ ] Setelah submit, cek `/debts/receivables` dan `/debts/payables` —
      pastikan TIDAK ada baris baru yang terbentuk dari transaksi ini.

## H. Create — Expense/Income langsung ke akun debt

- [ ] Buat transaksi **Pengeluaran** (bukan transfer) dari akun debt.
- [ ] Field Nama Kontak muncul, berlabel "(wajib)" (karena
      `involvesDebtAccount` true meski bukan transfer).
- [ ] Submit dengan kontak terisi — pastikan TIDAK ada baris `debts`
      baru terbentuk (logic otomatis di `apply-debt-transaction.ts`
      cuma jalan untuk `type='transfer'`), transaksi tetap tersimpan
      normal dengan `contact_id` terisi.

## I. Edit — belum ada debt link sama sekali

- [ ] Buat transaksi transfer kas→kas BIASA (bukan ke akun debt).
- [ ] Edit transaksi itu, ubah Ke Akun jadi akun debt, isi kontak,
      submit.
- [ ] Cek `/debts/receivables` — piutang baru muncul, seolah baru
      dibuat (karena memang baru pertama kali match kondisi debt).

## J. Edit — piutang induk yang BELUM dicicil (field berbahaya berubah)

- [ ] Ambil transaksi dari langkah B (piutang yang belum dicicil sama
      sekali).
- [ ] Edit, ubah **nominal**-nya (mis. dari Rp50.000 jadi Rp75.000),
      submit.
- [ ] Field kontak/nominal/akun TIDAK terkunci (masih bisa diedit bebas)
      — cek juga tidak ada pesan "sudah menerima cicilan" yang muncul.
- [ ] Cek `/debts/receivables` — piutang itu sekarang menunjukkan pokok
      Rp75.000 (bukan duplikat baris baru — jumlah baris piutang untuk
      kontak itu harus TETAP SAMA, cuma nominalnya yang berubah).

## K. Edit — piutang induk yang SUDAH dicicil (harus diblokir)

- [ ] Ambil piutang dari langkah D/E yang SUDAH pernah menerima
      pelunasan (dari transaksi terpisah).
- [ ] Edit transaksi INDUK piutang itu (transaksi yang pertama kali
      membuatnya, langkah B/C, BUKAN transaksi pelunasannya).
- [ ] Field Nominal, Akun, Ke Akun, Tipe Transaksi, dan Nama Kontak
      HARUS tampak terkunci (disabled/abu-abu) di form edit.
- [ ] Muncul pesan: "Piutang ini sudah menerima cicilan dari transaksi
      lain — kontak, nominal, dan akun tidak bisa diubah dari sini
      supaya riwayat cicilannya tidak hilang."
- [ ] Field **Catatan**, **Deskripsi**, **Tanggal**, dan lampiran foto
      TETAP bisa diedit bebas — coba ubah tanggalnya, submit berhasil.
- [ ] Cek `/debts/receivables` — tanggal piutang itu ikut berubah sesuai
      tanggal transaksi baru, TAPI pokok/sisa/status tidak berubah, dan
      cicilan yang sudah ada (dari transaksi lain) tetap utuh (cek
      jumlah baris `debt_payments` tidak berkurang — lihat query di
      bawah).

## L. Edit — transaksi pelunasan itu sendiri (recreate harus aman)

- [ ] Ambil transaksi PELUNASAN dari langkah D/E (bukan transaksi
      induknya).
- [ ] Edit nominalnya (mis. naikkan atau turunkan sedikit), submit.
- [ ] Field TIDAK terkunci (recreate pelunasan selalu aman).
- [ ] Cek `/debts/receivables` — sisa piutang induk ter-update sesuai
      nominal pelunasan yang baru; kalau nominal baru pas melunasi
      penuh sisa, status berubah jadi **Lunas**; kalau sebelumnya
      **Lunas** lalu nominal pelunasan dikurangi (jadi tidak lagi
      melunasi penuh), status harus KEMBALI ke **Berjalan**.

## M. Edit — cuma field aman (note/tanggal/lampiran) pada transaksi manapun

- [ ] Ambil transaksi ANAPUN yang sudah py debt link (baik induk maupun
      pelunasan, dicicil atau tidak).
- [ ] Edit HANYA field Catatan/Deskripsi/lampiran (jangan sentuh
      nominal/akun/kontak), submit.
- [ ] Pastikan tidak ada error, dan data `debts`/`debt_payments` terkait
      TIDAK berubah sama sekali (kecuali tanggal, kalau ikut diedit).

## Query verifikasi cepat (jalankan lewat `sqlite3` di salinan DB)

```sql
-- Semua debts + status pembayarannya
SELECT d.id, d.type, c.name AS contact, d.amount, d.status,
       d.transaction_id,
       d.amount - COALESCE((SELECT SUM(amount) FROM debt_payments WHERE debt_id = d.id), 0) AS remaining
FROM debts d LEFT JOIN contacts c ON c.id = d.contact_id
ORDER BY d.id;

-- Semua debt_payments + transaksi asalnya
SELECT * FROM debt_payments ORDER BY id;

-- Transaksi tertentu berperan apa (induk/pelunasan/tidak ada)?
SELECT 'principal' AS role, id FROM debts WHERE transaction_id = <ID>
UNION ALL
SELECT 'payment' AS role, id FROM debt_payments WHERE transaction_id = <ID>;
```

## Catatan known limitation (bukan bug, sudah didesain begini)

- Field `debt_action`/`settle_debt_ids` di form edit SELALU mulai
  kosong — kalau field berbahaya transaksi pelunasan diedit, harus
  pilih ulang piutang mana yang dilunasi dari awal (tidak direkonstruksi
  dari pilihan lama).
- Tidak ada UI untuk menghapus/membatalkan piutang secara manual (mis.
  `written_off`) — kolom `status` di DB mendukungnya, tapi belum ada
  tombol di `/debts/*` untuk itu (halaman masih read-only).
- Kredit/Paylater (Kredivo, Shopee PayLater) TIDAK termasuk
  `account_type='debt'` — sengaja ditunda, lihat
  `debt-receivable-tracking.md`.
