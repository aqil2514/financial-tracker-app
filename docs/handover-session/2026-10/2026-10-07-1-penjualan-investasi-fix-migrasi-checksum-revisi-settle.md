# Handover — 2026-10-07 (sesi 1)

Sesi panjang, dua bagian: (1) implementasi penuh fitur "Jual
Investasi" (penjualan/penarikan sebagian untuk tipe akun investasi)
yang sebelumnya cuma konsep — migrasi, logic, form, UI riwayat; (2)
dua insiden migrasi sqlx checksum yang ditemukan DAN diperbaiki di
tengah jalan; (3) revisi arsitektur signifikan menyusul pertanyaan
user soal realita settlement, yang mengubah ulang sebagian besar
logic yang baru saja ditulis di bagian (1).

## Ringkasan hasil sesi (kronologis)

### 1. Implementasi awal fitur jual investasi (SELESAI, lalu direvisi — lihat poin 4)

- Migrasi `0039_investment_sales.sql` — tabel baru `investment_sales`
  (`account_id`, `transaction_id`, `unit`, `price_per_unit`,
  `average_cost_per_unit`, `realized_pl`, `date`, `status`).
- `classifyAccountPair` dapat varian `investment-cash` (arah jual, di
  samping `cash-investment` yang sudah ada untuk beli). Dikonfirmasi
  `apps/worker` tidak ikut sync investment (desktop-only).
- `shared/investments/investment-holding-math.ts` baru —
  `getAverageCostPerUnit`/`getRemainingUnit`, satu sumber rumus average
  cost + "sisa unit yang bisa dijual" (beda dari `total_unit` yang
  dipakai Unrealized P/L: basis sisa unit cuma menghitung pembelian
  `settled`, bukan pending+settled).
- `apply-sell-investment-transaction.ts` — `applySellInvestmentTransaction`
  (+ `Edit`, `detachInvestmentSaleForDeletedTransaction`), desain awal:
  validasi oversell, average cost + Realized P/L dihitung & disimpan
  SAAT baris dibuat (snapshot permanen), efek ke `accounts.balance` via
  **2 transaksi** (leg transfer `average_cost × unit` + leg penyesuaian
  `income`/`expense` di akun kas sebesar selisih Realized P/L) — pola
  disetujui user dengan syarat "perbaiki link-nya": `adjustment_transaction_id`
  jadi FK eksplisit (bukan lookup lewat note+account+date), ditambahkan
  di migrasi `0040_investment_sales_adjustment_transaction.sql`.
- Form "Jual Investasi" khusus (`shared/investments/sell-investment-form/`)
  dipasang sebagai tombol di header `/investments/detail`, di samping
  "Catat Pembelian".
- `SalesHistoryTable` (`content/sales-history-table.tsx`) — riwayat
  penjualan per lot + Realized P/L berwarna hijau/merah.
- Form transaksi UTAMA (`fields/investment-fields.tsx`) diberi provisi
  arah jual juga (keputusan eksplisit lewat `AskUserQuestion` — "Ya,
  form utama perlu provisi juga"), simetris dengan arah beli.
- 3 bug berlapis ditemukan+diperbaiki di komponen input custom
  (`unit-amount-field.tsx`, `price-per-unit-field.tsx`) selama dogfooding
  manual: (a) `parseFloat` tidak mengenali koma desimal Indonesia —
  fix pakai `values.float` dari `react-currency-input-field`; (b)
  setelah fix (a), field jadi beku setelah paste karena `value={field.value}`
  langsung (controlled murni dari form state) — fix tambah state
  tampilan LOKAL (`display`) terpisah; (c) mode "Total" menampilkan
  presisi 13 digit (`Rp 9.999,971360000001`) saat blur — fix
  `Math.round(... * 100) / 100` di `computedDisplayValue`. Detail
  lengkap di [`docs/dogfooding/2026-10-07-unit-amount-field-koma-desimal-hilang-parsefloat.md`](../../dogfooding/2026-10-07-unit-amount-field-koma-desimal-hilang-parsefloat.md).
- Tooltip info ditambahkan ke label "Total" di `SettlementBreakdown`
  (pola sama tooltip "Modal" yang sudah ada) — menyusul pertanyaan user
  kenapa "Modal" dan "Total" bisa beda nominal (dikonfirmasi BUKAN bug,
  salah input unit/harga user sendiri).

### 2. Insiden migrasi checksum #1: edit file migrasi yang sudah applied

Setelah menambah kolom `adjustment_transaction_id`, saya (asisten)
sempat EDIT LANGSUNG file `0039_investment_sales.sql` yang sudah
ter-apply ke `finance.dev.db` user (asumsi salah: "belum pernah
benar-benar dijalankan"). Dashboard error "migration 39 was previously
applied but has been modified" di seluruh app. **Fix**: `0039`
dikembalikan ke SQL asli, kolom baru dipindah ke migrasi `0040`
TERPISAH (`ALTER TABLE ADD COLUMN`, tidak perlu copy-and-rename karena
`investment_sales` tidak direferensikan FK tabel lain).

### 3. Insiden migrasi checksum #2: komentar dokumentasi di file applied

SETELAH fix #2, saya menambahkan komentar "CATATAN:" di `0039` untuk
mendokumentasikan insiden #1 — tidak sadar checksum sqlx dihitung dari
SELURUH isi file TERMASUK komentar, walau SQL eksekusinya identik.
Error checksum mismatch yang SAMA muncul lagi. **Fix**: komentar
dihapus (kembali ke SQL minimal), dan karena file hasil revert tidak
bisa dijamin byte-identik dengan yang pertama kali di-checksum, user
mengizinkan (`AskUserQuestion`, "Ya, lakukan (Recommended)") perbaikan
via akses database langsung: backup `finance.dev.db` dulu, verifikasi
tabel `investment_sales` kosong (0 baris), lalu hapus record migrasi
39+40 dari `_sqlx_migrations` + drop tabel kosong tsb supaya migrasi
re-run bersih dari file saat ini. Data riil (`investment_purchases`, 3
baris) tidak tersentuh. User konfirmasi restart `tauri dev` berhasil
tanpa error lagi.

Kedua insiden didokumentasikan lengkap di memory
`feedback_migration_never_edit_applied.md` (prosedur pemulihan HANYA
berlaku kalau tabel terkait dikonfirmasi kosong — tidak repeatable
kalau sudah ada data nyata).

### 4. Revisi arsitektur: dana BARU cair saat settled

User bertanya, setelah melihat baris Realized P/L muncul di baris
berstatus "Pending": "Secara riilnya memang seperti itu? Penjualan
sedang diproses, uangnya memang bisa langsung digunakan?" — jawaban
jujurnya TIDAK: desain awal (poin 1) membuat transaksi transfer+P/L
LANGSUNG saat baris dibuat, terlepas dari status. Secara riil (reksadana
T+1/T+2), dana baru cair setelah settlement, padahal unit memang sudah
berkurang duluan (itu yang benar). User eksplisit: **"realized pl
jangan ditulis saat pending. Baru ditulis ketika benar benar terjual,
settled"**, dan memilih opsi desain "larang pending di form utama,
pending HANYA dari dialog Jual Investasi khusus — ide 'menu aksi
titik-tiga' generik lintas fitur didiskusikan terpisah nanti, bukan
sekarang".

Perombakan:

- **Migrasi `0041_investment_sales_nullable_realized_pl.sql`** (copy-and-rename,
  tabel masih kosong) — `average_cost_per_unit`/`realized_pl` jadi
  NULLABLE.
- **`apply-sell-investment-transaction.ts` dirombak total**:
  `applySellInvestmentTransaction` TIDAK LAGI insert leg transfer
  sendiri — disamakan polanya dengan `applyInvestmentTransaction`/
  `applyDebtTransaction` (caller insert `transactions`, fungsi `apply*`
  urus baris satelit saja). Parameter `transactionId: string | null` —
  `null` WAJIB untuk `pending` (baris `investment_sales` dibuat dengan
  SEMUA kolom turunan NULL, TIDAK ADA transaksi apa pun dibuat), non-null
  WAJIB untuk `settled` (caller sudah insert leg transfer lebih dulu).
  Fungsi baru `settleInvestmentSale(db, saleId, transferAccountId)` —
  dipanggil dari aksi UI terpisah, insert leg transfer + leg penyesuaian
  P/L SENDIRI (tidak ada "caller form" di jalur ini), hitung average
  cost & Realized P/L dari kondisi SAAT settle (bukan saat create).
  Fungsi baru `deletePendingInvestmentSale` — hapus baris pending
  langsung (tidak ada transaksi untuk dibersihkan).
- **Form transaksi utama HANYA mendukung jual `settled`** — toggle
  status disembunyikan untuk arah jual, dipaksa `"settled"` lewat
  `useEffect` di `InvestmentFields`. Alasan: form ini secara arsitektur
  SELALU insert satu baris `transactions` per submit (dipakai bersama
  semua tipe transaksi), kontradiktif dengan "pending tidak boleh
  insert apa pun".
- **Dialog "Jual Investasi" khusus** (`use-create-investment-sale.ts`)
  jadi satu-satunya jalur status `pending` — untuk `settled`, hook ini
  sendiri yang insert leg transfer (pola sama form beli/utang) sebelum
  memanggil `applySellInvestmentTransaction`.
- **UI baru**: `SalesHistoryTable` dapat tombol "Settle" (dialog baru
  `shared/investments/settle-sale-form/`, minta pilih akun kas tujuan
  karena baris pending tidak menyimpannya) dan tombol hapus
  (`ConfirmDeleteButton` existing + hook baru
  `use-delete-pending-investment-sale.ts`) khusus baris `pending`. Baris
  `settled` tidak punya aksi apa pun di tabel ini (koreksi lewat
  edit/hapus transaksi utama, konsisten dengan baris lain yang punya
  transaksi riil).
- Test diupdate menyeluruh (`apply-sell-investment-transaction.test.ts`
  ditulis ulang, + test Rust baru untuk verifikasi kolom nullable).
- Konsep (`konsep-investasi.md`) dan todo doc (`account-type-investment.md`)
  diperbarui — bagian baru "Dana BARU cair saat settled" + revisi
  "Realized gain/loss".

## Status kode & data saat ini

- **Kode**: seluruh perubahan (implementasi awal + 2 fix migrasi +
  revisi arsitektur) ada di working tree, BELUM di-commit (belum
  ditanya eksplisit ke user dalam sesi ini).
- **Database lokal** (`finance.dev.db`): migrasi 39-41 sudah bersih
  ter-apply ulang setelah insiden #2 (lihat poin 3) — user konfirmasi
  restart `tauri dev` berhasil. Backup dibuat sebelum operasi
  destruktif: `finance.dev.db.bak_20261007_052215_fix-migration-39-40-checksum`
  di `%APPDATA%/com.windows.financial-app/`.
- **Verifikasi otomatis**: `tsc --noEmit` bersih, 206/206 test vitest
  lulus (desktop), 7/7 test Rust `migrations` lulus (termasuk test baru
  utk kolom nullable).
- **Verifikasi manual**: BELUM dilakukan sama sekali untuk fitur jual
  investasi (baik versi awal maupun versi revisi settle) — lihat Gap
  tersisa.

## Gap yang TERSISA untuk sesi berikutnya

1. **Smoke test manual lengkap di `tauri dev`** — belum pernah dicoba
   sama sekali. Perlu: (a) submit jual **pending** lewat dialog "Jual
   Investasi" khusus, cek TIDAK ADA transaksi dibuat & unit tetap
   berkurang dari holding; (b) submit jual **settled** dari KEDUA jalur
   (dialog khusus DAN form transaksi utama), cek balance berkurang
   sesuai average cost (bukan nominal jual), cek transaksi penyesuaian
   Realized P/L muncul otomatis di akun kas; (c) validasi oversell di
   kedua form; (d) edit transaksi jual settled (prefill + recreate
   average cost) di form utama; (e) tombol **Settle** di
   `SalesHistoryTable` — pilih akun kas, transaksi baru muncul, status
   jadi settled, average cost/Realized P/L terisi; (f) tombol **Hapus**
   baris pending — unit kembali ke holding. Breakdown lengkap ada di
   `account-type-investment.md` bagian "Sesi berikutnya".
2. **Commit kode** — belum ditanya/dilakukan sama sekali dalam sesi
   ini, mencakup implementasi awal + 2 fix migrasi + revisi arsitektur
   sekaligus (kemungkinan perlu dipecah beberapa commit, bukan satu
   commit besar — belum didiskusikan dengan user).
3. **Ide UX "menu aksi titik-tiga" generik untuk settle** — user
   menyinggung ini berlaku lintas fitur (bukan cuma investasi), sengaja
   DITUNDA, didiskusikan terpisah nanti. Belum ada dokumen rencana
   sendiri untuk ini.
4. **Item lama yang masih terbuka** (tidak tersentuh sesi ini): MCP
   tool `get_investment_summary` (belum diputuskan digarap atau tidak),
   migrasi data akun lama yang masih `cash` tapi sebenarnya investasi
   (ditunda sengaja), utang desain kolom `status` sebagai solusi
   sementara sebelum tipe akun `advance` ada.
5. **Release notes `docs/release/v0.1.4.md`** — diminta diupdate di
   sesi ini juga (lihat commit/instruksi terbaru), cek apakah sudah
   tercermin perubahan sesi ini sebelum sesi berikutnya dimulai.

## Catatan proses (feedback untuk sesi berikutnya)

- **User menguji asumsi "sudah benar" dengan pertanyaan realita
  sederhana** — "Secara riilnya memang seperti itu?" membongkar gap
  arsitektur yang lolos dari implementasi awal DAN dari semua test
  otomatis (test lolos karena mengetes logic yang ditulis, bukan
  apakah logic itu sendiri masuk akal secara domain). Pelajaran:
  setelah desain disetujui & diimplementasikan, tetap terbuka kalau
  user balik bertanya dengan sudut pandang "apakah ini match realita",
  bukan asumsikan fitur selesai hanya karena test hijau.
- **Jangan pernah edit file migrasi yang sudah applied — termasuk
  SEKADAR menambah komentar dokumentasi** — insiden #2 terjadi justru
  dari niat baik (mendokumentasikan insiden #1 di lokasi migrasinya
  sendiri). checksum sqlx menghitung SELURUH isi file. Lihat
  [[feedback_migration_never_edit_applied]] di memory (sudah diperluas
  mencakup kedua insiden).
- **User eksplisit minta opsi desain yang scope-nya LEBIH SEMPIT untuk
  sekarang, menunda yang lebih besar** — soal form utama vs jual
  pending, user memilih "larang pending di form utama" (scope kecil,
  selesai sesi ini) atas "transaksi dummy dihapus belakangan" (lebih
  rumit), SAMBIL menyinggung ide lebih besar (menu aksi generik lintas
  fitur) yang SENGAJA tidak dikerjakan sekarang. Pelajaran: saat user
  menyebut ide besar tapi bilang "nanti saja", catat sebagai gap
  tersisa (jangan diam-diam dikerjakan atau dilupakan), jangan
  diperluas scope-nya tanpa diminta.
- **Perubahan skema yang menyentuh kolom NOT NULL → nullable di SQLite
  butuh copy-and-rename**, bukan `ALTER TABLE ALTER COLUMN` (tidak ada
  di SQLite) — pola yang sudah dipakai migrasi `0038` (tabel lain,
  kasus sama) diikuti lagi persis untuk migrasi `0041`.
