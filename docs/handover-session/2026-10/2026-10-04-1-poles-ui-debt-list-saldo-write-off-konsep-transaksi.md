# Handover — 2026-10-04 (sesi 1)

Sesi START dari user bertanya "ada todo apa saja" di
`apps/desktop/docs/todos/plan/`, lalu zoom-in ke
`debt-receivable-tracking.md` (todo paling matang). Berkembang jadi:
fix bug UI dialog scroll (dipicu screenshot user), lanjut poles
`DebtListTable` (pindah kolom aksi, pagination, filter/sort/period,
tombol reset, aksi write-off), lalu PIVOT PENTING ke bug akuntansi
(saldo akun tidak ikut nol saat write-off/non_cash settlement) yang
berujung dokumen konsep baru, dan ditutup dengan tambahan filter
"Status Cicilan" + expandable row riwayat cicilan di tabel. Sesi
panjang, dicatat kronologis.

## Ringkasan hasil sesi (kronologis)

### 1. Fix scroll dialog detail kontak (Utang Piutang)

- User screenshot dialog "Detail — {kontak}" yang tumbuh tak terbatas
  saat baris riwayat piutang (expandable) di-expand/collapse berulang.
- Debugging PANJANG via DevTools bolak-balik dengan user (screenshot
  Elements/Computed/Console berkali-kali) — akar masalah: `DialogContent`
  dasarnya `grid`, constraint tinggi via `flex flex-col` + `ScrollArea`
  (`flex-1`) GAGAL diteruskan ke `ScrollAreaPrimitive.Viewport` (base-ui)
  — Viewport selalu auto-grow ke `scrollHeight` kontennya sendiri,
  walau computed height Root sudah benar (dikonfirmasi: Root 611px
  tapi Viewport tetap 902px, `scrollTop` bisa di-set tapi tidak
  berefek visual).
- **Fix yang akhirnya bekerja**: ganti `DialogContent` dari flex ke
  **CSS Grid** (`grid-rows-[auto_1fr]`) — grid row `1fr` memberi child
  height yang definite dengan cara lebih reliable utk nested
  percentage-height ini. `EntityFormDialog` dapat opsi baru
  `scrollBody`. Komponen `ScrollArea` global (dipakai 10+ tempat lain
  dgn tinggi fixed) TIDAK disentuh.
- **Sempat dicoba & GAGAL**: `overflow-hidden` saja (clip tapi tidak
  scrollable), `position: absolute; inset: 0` pada Viewport (konten
  jadi tidak muncul sama sekali) — dicatat di history diskusi, bukan
  di kode.

### 2. Poles `DebtListTable` — kolom aksi, pagination, filter/sort/period, reset

- Kolom aksi (`⋯`) dipindah dari paling kanan ke paling kiri.
- Daftar dipaginasi di SQL (`LIMIT/OFFSET` + `COUNT(*)`, pola sama
  `useAccountsPaginated`) — `useDebtsList` lama (fetch-semua) dipecah
  jadi `useAllDebtsList` (dipertahankan utk `DebtsSummaryPageProvider`)
  + `useDebtsList` baru yang paginated.
- Ditanya dulu ke user: kolom apa yang perlu difilter/disortir (lewat
  `AskUserQuestion`) — hasilnya: filter Status/Kontak/Akun/Rentang
  tanggal, sort Tanggal/Sisa/Pokok/Kontak/Akun.
- Diimplementasikan pakai infrastruktur `components/query/` yang sudah
  ada (`FilterPanel`, `SortDropdown`, `buildWhereClause`,
  `buildOrderClause`) — BUKAN bangun baru. Rentang tanggal pakai
  `PeriodPicker` (BUKAN `FilterPanel` tipe `date` — itu belum
  diimplementasikan di UI, `FilterDate` masih di-comment-out), atas
  saran eksplisit user yang menunjuk pola sama di halaman detail akun.
- Tombol "Reset" ditambahkan atas permintaan user — mengosongkan
  filter+sort+dateRange sekaligus, cuma muncul kalau ada yang aktif.

### 3. Aksi "Tandai Dihapuskan" (`written_off`) — DAN bug akuntansi yang ditemukan

- Dibangun pertama kali SANGAT sederhana: cuma `UPDATE debts SET
  status = 'written_off'`, tanpa transaksi apa pun.
- **User tanya kritis**: "logic untuk write off ini juga mempengaruhi
  saldo akun kan ya?" — jawaban awal saya SALAH (bilang "tidak, dan itu
  sengaja"). User mengoreksi: "sepertinya ini menyalahi konsep
  konsep-tipe-akun.md".
- Setelah baca ulang `konsep-utang-piutang.md` bersama user: ketemu
  prinsip eksplisit "baik piutang maupun utang sama-sama mengarah ke
  nol saat diselesaikan" — **Dihapuskan TERMASUK bentuk "diselesaikan"**,
  jadi saldo akun debt WAJIB ikut nol, bukan nyangkut.
- User tanya tajam: "saldo itu kolom tersendiri atau hasil agregasi?"
  — dikonfirmasi: **selalu agregasi** dari `transactions` (bukan kolom
  tersimpan), jadi satu-satunya cara memperbaiki saldo adalah BUAT
  TRANSAKSI, bukan opsi lain (tidak perlu kolom `balance` baru).
- User lanjut tanya "atau mungkin transaksi ini tidak selalu
  berkaitan dengan uang?" lalu diklarifikasi sendiri: **"berkaitan
  dengan uang"** (bukan dilonggarkan jadi kategori non-uang baru).
- **Fix final**: write-off membuat transaksi `expense`
  (receivable)/`income` (payable) penutup LANGSUNG pada
  `debt.account_id` sebesar sisa, + `debt_payments` biar `remaining`
  jadi 0 — pola sama dgn `correctAccountBalance` yg sudah ada. Kasus
  `account_id == null` (sync Retailku) DITOLAK dgn pesan jelas, bukan
  jalan pintas diam-diam (keputusan eksplisit user: "ini perlu tindak
  lanjut sendiri").
- **Bug IDENTIK ditemukan sekaligus** di `settlement_mode: 'non_cash'`
  (`use-pay-debt.ts`, pelunasan barter/pemutihan/offset) — akar
  masalah sama persis, diperbaiki dengan pola yang sama. Keputusan
  lama di `debts-sync-and-non-transfer-debts.md` ("written_off tidak
  perlu dibangun terpisah") ikut ditandai SUPERSEDED.

### 4. Dokumen konsep baru: `docs/concept/konsep-transaksi.md`

- User minta eksplisit: tulis dokumen konsep baru merumuskan "transaksi
  SELALU berkaitan dengan uang, TAPI tidak selalu representasi uang
  fisik/digital berpindah saat itu juga" — supaya jadi rujukan tunggal
  utk fitur masa depan (Investasi, dll), bukan cuma catatan di komentar
  kode 2 tempat.
- Isi: transaksi sbg satu-satunya jalur sah mengubah saldo; 2 jenis
  transaksi (uang riil vs penutup); contoh nyata (Koreksi Saldo,
  write-off, non_cash); kenapa prinsip ini sempat dilanggar & kenapa
  salah; implikasi utk fitur baru (tipe akun masa depan).
- Referensi silang 2 arah ditambahkan ke `konsep-tipe-akun.md` dan
  `konsep-utang-piutang.md`.

### 5. Filter "Status Cicilan" + expandable row riwayat cicilan di tabel

- User tanya: bisa tidak filter "sudah dicicil vs belum dicicil"
  (beda dari filter Status yang sudah ada — piutang bisa `ongoing`
  DAN sudah dicicil sebagian, atau `ongoing` dan belum tersentuh sama
  sekali).
- Ditangani TERPISAH dari `buildWhereClause` generik (butuh
  `EXISTS`/`NOT EXISTS` subquery ke `debt_payments`, bukan perbandingan
  kolom biasa) — tetap muncul di `FilterPanel` yang sama lewat
  `extraConditions` manual, disederhanakan jadi binary select.
- Sebelumnya juga ditambahkan: baris `DebtListTable` bisa diklik utk
  expand riwayat `debt_payments` langsung (chevron + `colSpan`, klik
  kolom aksi `⋯` tidak ikut trigger lewat `stopPropagation`).
  `PaymentsList` (sebelumnya inline di `debt-row.tsx` dialog detail
  kontak) diekstrak jadi shared component
  (`shared/debts/payments-list.tsx`) dipakai di kedua tempat.

## Status kode saat ini

- **Sebagian besar sesi ini SUDAH ter-commit oleh user sendiri** di
  `5dab6a9` ("Update konsep transaksi, update utang piutang, revisi
  utang piutang") — mencakup poin 1-4 di atas (scroll fix, pagination,
  filter/sort pertama, write-off + non_cash fix, konsep-transaksi.md).
  Commit ini dibuat user DI LUAR permintaan eksplisit, ditemukan saat
  cek `git log` sebelum menulis handover ini.
- **BELUM ter-commit** (working tree saat ini) — poin 5 (filter "Status
  Cicilan" + expandable row) dan update terakhir `docs/release/v0.1.2.md`:
  - `apps/desktop/docs/todos/plan/debt-receivable-tracking.md` (modified)
  - `apps/desktop/src/features/debts-summary/content/card/detail/debt-row.tsx` (modified)
  - `apps/desktop/src/features/debts/debt-list-table.tsx` (modified)
  - `apps/desktop/src/shared/debts/use-debts-list.ts` (modified)
  - `docs/release/v0.1.2.md` (modified)
  - `apps/desktop/src/shared/debts/payments-list.tsx` (BARU, untracked)
- `tsc --noEmit` dan `vitest run` (debts-related) bersih di setiap
  langkah — belum dijalankan full `npm run build` di sesi ini.
  `next lint` TIDAK bisa jalan (error "no such directory: .../lint",
  kemungkinan versi Next.js ini belum support `next lint` CLI lama —
  belum diselidiki lebih jauh, bukan blocker).
- `docs/release/v0.1.2.md` sudah mencakup SEMUA perubahan sesi ini
  (termasuk yang belum di-commit) — siap jadi release notes utuh kalau
  sesi berikutnya langsung lanjut commit+release.

## Gap yang TERSISA untuk sesi berikutnya

Checklist lengkap ada di `debt-receivable-tracking.md` bagian "Status &
TODO saat ini (ringkas)" — ringkasan item yang masih `[ ]`:

1. **Jatuh tempo & reminder** — belum diputuskan masuk scope awal atau
   tidak, belum ada desain sama sekali.
2. **Empty state** `/debts` — ilustrasi/pesan ramah saat tabel kosong
   (saat ini cuma teks polos).
3. **Write-off untuk `debts` dari sync Retailku** (`account_id` NULL)
   — sengaja DITOLAK dulu di `useWriteOffDebt`, butuh tindak lanjut
   terpisah (kemungkinan terkait `retailku-sync-account-type-gap.md`,
   BELUM dibaca ulang di sesi ini).
4. **Revert status `paid`→`ongoing`** saat edit pembayaran yang
   sebelumnya melunasi penuh — variasi kecil, risiko rendah menurut
   catatan lama, belum pernah diuji langsung.
5. **Transfer ke akun `debt` non-personal** (mis. "Modal") — diperlakukan
   sama seperti piutang personal, belum ada pengecualian.
6. **Commit working tree saat ini** — poin 5 di "Ringkasan hasil sesi"
   belum di-commit, perlu diputuskan apakah lanjut commit dulu di awal
   sesi berikutnya atau user commit sendiri lagi (pola yang berulang).

## Catatan proses (feedback utk sesi berikutnya)

- **User melakukan root-cause debugging visual LANGSUNG lewat DevTools
  bolak-balik** (poin 1) — bukan cuma terima penjelasan, tapi aktif
  kirim screenshot Elements/Computed/Console sesuai instruksi saya
  sampai akar masalah ketemu pasti. Pola bagus: kalau butuh data visual
  yang tidak bisa saya akses langsung (tidak ada browser di sandbox),
  MINTA command spesifik + screenshot, JANGAN tebak-tebak dari baca
  kode saja — terbukti beberapa dugaan saya (flex vs grid, overflow-hidden)
  salah sebelum DevTools membuktikan akar masalah sebenarnya.
- **User mengoreksi klaim teknis saya yang SALAH dengan pertanyaan
  tajam, bukan langsung kasih jawaban** (poin 3) — "logic ini juga
  mempengaruhi saldo akun kan ya?" sengaja dijawab cepat (salah) oleh
  saya, lalu dikoreksi lewat "sepertinya ini menyalahi konsep...". Pola
  bagus utk ditiru: SEBELUM menjawab pertanyaan "apakah X mempengaruhi
  Y" dengan tegas, cek ulang implementasi aktualnya dulu (saya tidak
  cek `calculate-balance`/`use-accounts.ts` sebelum menjawab pertama
  kali) — terutama kalau jawabannya bisa dicek via grep/read cepat.
- **User punya insting kuat ke arah "dokumentasikan sebagai konsep",
  bukan cuma "perbaiki lalu lanjut"** — setelah fix bug akuntansi,
  user TIDAK langsung minta lanjut fitur lain, tapi tanya "ada tidak
  konsep yang membahas transaksi?" dan minta ditulis jadi dokumen baru.
  Pola ini SUDAH terlihat di sesi-sesi sebelumnya (`konsep-tipe-akun.md`,
  `konsep-utang-piutang.md`) — insight besar yang muncul dari diskusi
  bug SELALU berpotensi pantas jadi dokumen `docs/concept/` baru,
  bukan cuma komentar kode. Tawarkan proaktif kalau pola serupa muncul
  lagi.
- **User minta dokumentasi diupdate SESERING mungkin, bukan ditunda
  sampai akhir sesi** — hampir tiap langkah besar diikuti "update
  checklist"/"update release notes" sebagai permintaan terpisah,
  bukan sekali di akhir. Pola bagus: tawarkan update dokumentasi
  segera setelah tiap perubahan kode signifikan selesai, jangan
  menumpuk sampai akhir.
- **Validasi via `AskUserQuestion` dipakai efektif utk keputusan
  desain kecil-menengah** (kolom filter/sort apa saja, sumber opsi
  Akun, kasus `account_id` NULL) — user selalu menjawab cepat & jelas,
  tidak pernah menganggap pertanyaan itu berlebihan. Lanjutkan pola
  ini utk keputusan yang punya >1 opsi valid secara teknis.
