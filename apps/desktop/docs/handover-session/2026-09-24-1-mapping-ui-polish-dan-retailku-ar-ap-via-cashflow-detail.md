# Handover — 2026-09-24 (sesi 1)

Lanjutan dari `2026-09-23-3-retailku-sale-category-eksplorasi-dan-sync-field-mapping.md`.
Sesi ini: (1) verifikasi + poles UI tab Mapping yang ter-commit sesi
lalu, (2) hapus halaman `/retailku/mapping` lama beserta gate
`hasMappings`, (3) rancang & implementasikan arsitektur baru sync
AR/AP (lintas repo `retail-multitenant` + `financial-app`) yang
menggantikan `get_ar_ap`/snapshot-diff, (4) temukan & perbaiki bug
migrasi SQLite laten yang TIDAK terkait AR/AP tapi menghalanginya.

## 1. Verifikasi + poles UI tab Mapping (commit `a9c04fd` sesi lalu) — SELESAI

Sesuai catatan wajib di handover sebelumnya: `tsc`/`vitest`
(101→102)/`next build` semua bersih untuk commit itu. Lanjut serangkaian
perbaikan UI dari feedback iteratif user:

- **Fix `SelectValue` menampilkan value mentah** (`"summary"`/`"detail"`,
  bukan label) — `@base-ui/react` Select butuh `children` render-prop
  eksplisit di `SelectValue`, TIDAK otomatis cari label `SelectItem`
  yang cocok (beda dari asumsi awal). Diperbaiki di 3 tempat: akun
  tujuan, kategori, mode.
- **Restrukturisasi tab Mapping**: dari tabel (1 baris = 1 key, makan
  ruang ke bawah kalau key banyak) jadi tab (1 tab = 1 key, label
  ANGKA URUT saja) + panel "Ringkasan semua jenis" TERPISAH (daftar
  SEMUA key dengan status Terisi/Kosong, klik untuk lompat tab) —
  komponen baru `components/array-field-tabs.tsx` (generik, TANPA
  react-hook-form, porting dari `array-field-tabs.tsx` retail-multitenant
  yang di-review user duluan, tapi versi RHF SENGAJA belum dibuat,
  ditunda sesuai arahan "buat generik dulu").
- **Select → Combobox** untuk akun tujuan & kategori, label
  disambiguasi pakai grup akun/kategori induk (pola sama
  `use-account-category-options.tsx` form transaksi) — user melaporkan
  ada akun dengan nama sama persis ("Kantong Utama" 2x).
- **Textarea → RichTextEditor** untuk deskripsi — `MappingRowDraft.description`
  diubah dari `string` jadi `JSONContent | null` (SAMA pola `description`
  form transaksi: `JSON.stringify`/`JSON.parse` di titik simpan/baca,
  BUKAN disimpan sebagai objek langsung).
- **Fix overflow container** (`min-w-0` di rantai flex/grid — default
  `min-width: auto` menolak menyusut di bawah lebar konten intrinsik
  child, `w-full` saja TIDAK cukup) — berulang di beberapa tempat
  (`ArrayFieldTabs`, grid form).
- **Date input → `PeriodPicker`** (komponen existing, preset
  Hari/Minggu/Bulan/dst) menggantikan 2 `<input type="date">` terpisah.
- **Bug fungsional ditemukan+diperbaiki**: key campur ringkasan+detail
  MUNCUL BERSAMAAN di daftar terlepas mode yang dipilih — akar
  masalah di `use-mapping-draft.ts` (`rows` useMemo): mapping tersimpan
  lama (`savedMapping`) yang belum "ketemu" lagi di rentang tanggal
  saat ini ditambahkan TANPA filter mode. Diperbaiki: filter
  `saved.key.startsWith(\`${mode}:\`)`.
- **Overview panel**: `ScrollArea` (bukan `overflow-y-auto` manual)
  + icon info dg `Tooltip` yang menampilkan SEMUA field 1 row dalam
  1 tempat (RichTextViewer utk deskripsi).

Semua perubahan di atas SUDAH lolos `tsc`/`vitest`/`next build`
berulang kali sepanjang sesi (tidak dirinci satu-satu di sini, lihat
riwayat commit/diff untuk detail tepatnya kalau perlu).

## 2. Hapus halaman `/retailku/mapping` lama + gate `hasMappings` — SELESAI

User eksplisit minta dihapus setelah ditanya "masih diperlukan tidak
ya?" — halaman itu sudah placeholder mati sejak migrasi 0020 (tabel
sumbernya di-drop), fungsinya sudah sepenuhnya digantikan tab Mapping
baru.

- Dihapus: route `app/(app)/retailku/mapping/page.tsx`, folder
  `features/retailku/mapping/` (3 file), entry sidebar "Mapping Akun",
  re-export mati di `features/retailku/index.ts`.
- **Dipertahankan** (BUKAN bagian halaman yang dihapus): `useRetailkuAccountMapping`/
  `useRetailkuMappingIssues` di `shared/retailku` — masih dipakai
  GLOBAL oleh badge sidebar & deteksi orphan mapping, TIDAK terkait
  route yang dihapus.
- **Gate `hasMappings` DIHAPUS dari `canSync`/`canPreview`** (tombol
  "Sync Sekarang"/"Lihat Preview" di tab Konfigurasi) — alasan: dengan
  key mapping granular per mode+sourceType+arah, "mapping ADA" tidak
  lagi berarti "cukup untuk sync semua baris"; sync per baris SUDAH
  skip sendiri key yang belum dipetakan (toast peringatan), jadi gate
  KESELURUHAN tombol cuma memblokir baris LAIN yang justru valid.
  Section "Mapping Akun" (`mapping-status-section.tsx`) di tab
  Konfigurasi ikut dihapus karena alasan sama.

Semua perubahan ini SUDAH lolos `tsc`/`vitest`/`next build`.

## 3. Sync AR/AP via `get_cashflow_detail` — DIRANCANG & DIIMPLEMENTASIKAN, BELUM DIKONFIRMASI "OKE"

### Latar belakang penemuan

Dipicu pertanyaan user "cek cashflow tanggal 22, ada yang terkait
utang piutang" → ditemukan baris `SALE_PAYMENT` (pelunasan piutang)
→ pertanyaan lanjutan "utang piutangnya sudah dihandle belum?" →
investigasi database PROD (`finance.db`) menemukan **bug nyata**:
`retailku_ar_ap_snapshot` terisi 4 pihak, TAPI **tidak ada satu pun
transaksi `debts`/`transactions`** untuk kontak generik "Piutang
Retailku"/"Utang Retailku" — snapshot maju tapi transaksi hilang
(vs `finance.dev.db` yang TERBUKTI berhasil, 5+ baris `debts` valid).

User lalu mengusulkan sudut pandang berbeda: alih-alih sekadar
memperbaiki bug rollback itu, **perluas `get_cashflow_detail` di sisi
Retailku** supaya sekaligus membawa data piutang/utang — menghindari
2x panggilan MCP dan 2 mekanisme idempotency berbeda sekaligus.

### Temuan kunci (dari eksplorasi `docker exec` ke `multi-retail-db`)

- Retailku **SUDAH** mencatat piutang/utang sebagai jurnal PER-TRANSAKSI
  individual (bukan snapshot) — dibuktikan lewat `journal_entries`/
  `journal_items` untuk `SL-260912-09` (piutang baru, debit akun 1500)
  dan `SP-260922-01` (pelunasannya, kredit akun 1500 yang SAMA,
  `sourceSnapshot.paymentType: "SETTLEMENT"`).
- Chart akun piutang/utang KONSISTEN lintas semua toko: kode 1500/1700/
  1800 (ASSET, piutang dagang/supplier/lain-lain) dan 2100/2200/2300
  (LIABILITY, utang dagang/lain-lain/hutang penitip).
- **KENAPA belum muncul di `get_cashflow_detail`**: filter query
  `isTrackedAsset: true` — 6 akun di atas semuanya `false` (SENGAJA
  dibatasi ke akun likuid waktu awal dibangun).
- **Koreksi penting mid-investigasi**: dugaan awal "perlu kolom flag
  baru di skema `Account`" TERBUKTI TIDAK PERLU — sudah ada model
  `AccountMapping`/`AccountMappingRole` (`TRADE_RECEIVABLE`,
  `SUPPLIER_RECEIVABLE`, `OTHER_RECEIVABLE`, `ACCOUNTS_PAYABLE`,
  `OTHER_PAYABLE`, `CONSIGNMENT_PAYABLE`) yang PERSIS menjawab
  kebutuhan ini, **terverifikasi terisi lengkap di 37/37 toko aktif**.
  Jadi implementasi jadi PURE QUERY TAMBAHAN, TANPA migrasi skema sama
  sekali.

Dokumen rancangan lengkap: `docs/todos/plan/retailku-ar-ap-via-cashflow-detail.md`
(SUDAH diupdate akhir sesi ini mencerminkan status implementasi penuh
+ bug yang ditemukan, JANGAN baca versi lama dari cache/ingatan).

### Implementasi sisi Retailku (`retail-multitenant`) — SELESAI, TERVERIFIKASI

`get-cfr-detail.helper.ts`: query tambahan `accountMapping.findMany`
(6 role) → `Set<accountId>` → filter `OR isTrackedAsset/id-in-set`
diperluas ke query utama DAN nested `items:` → 2 field baru
(`isReceivablePayableAccount`, `receivablePayableDirection`, dari
`role.includes('PAYABLE')`). **Diverifikasi lewat MCP call nyata**
setelah restart server: 31→33 baris utk tanggal 22 Sep, 2 baris baru
PERSIS sesuai ekspektasi (pelunasan piutang `SP-260922-01` + hutang
penitip `SL-260922-15` dg nilai SAMA PERSIS `nonRevenuePortion`-nya).
`tsc`/`eslint` bersih (1 auto-fix prettier).

### Implementasi sisi financial-app — SELESAI, TERVERIFIKASI (dg insiden)

File baru: `extract-ar-ap-rows.ts`, `is-ar-ap-row-synced.ts`,
`insert-ar-ap-transaction.ts`. Diubah: `get-cashflow-detail.ts` (+field
`id`, 2 field baru), `aggregate-by-*.ts` (kecualikan baris AR/AP),
`types.ts` (`ArApSyncPlanRow`, `SyncCashflowInput`/`Result` diperluas),
`compute-cashflow-sync.ts` (hitung plan AR/AP paralel), `sync-cashflow.ts`
(insert dalam 1 alur + `SyncCashflowPartialError` utk rollback parsial),
`sync-all.ts` (disederhanakan, SATU panggilan bukan dua),
`use-preview-sync.ts`/`preview-sync-section.tsx` (preview AR/AP dari
`cashflow.arApRows`), `use-sync-now.ts`/`use-retailku-auto-sync.ts`
(toast `arApAccountNotConfigured`), `use-load-mapping-keys.ts` (pass
`null` utk field AR/AP, baca-saja). **Dihapus**: `sync-ar-ap.ts`
(beserta `retailku_ar_ap_snapshot`, migrasi `0021`).

**Koreksi arah mid-implementasi** (bukan diasumsikan, ditemukan lewat
pembacaan ulang `use-pay-debt.ts` yang SUDAH ADA): tebakan pertama
"pelunasan utang arahnya cash→debt" SALAH — pelunasan piutang MAUPUN
utang SAMA-SAMA `debt→cash`, dibedakan `debtAction:"settlement"` +
`settleDebtIds` yang difilter `type`. `applyDebtTransaction` (shared)
TERNYATA SUDAH LENGKAP tanpa perlu cabang baru — keputusan awal
"tambah cabang di `applyDebtTransaction`" (dari AskUserQuestion)
DIBATALKAN begitu kesalahan ini ketahuan.

**FIFO otomatis** utk pelunasan (keputusan user: bukan lagi "di luar
cakupan") — `loadOngoingDebtIds` ambil SEMUA `debts` ongoing kontak
generik terkait, urut tertua, reuse `settleDebtsFifo` yang SUDAH ADA
(TIDAK diubah). Test `sync-all.test.ts` DITULIS ULANG total (struktur
`syncAll` berubah dari 2 panggilan jadi 1) — 102/102 test lulus.

### Bug ditemukan saat testing — TERPISAH dari AR/AP, SUDAH DIPERBAIKI

Toast merah "no such table: main.transactions_old" saat "Sync
Sekarang" ditekan pertama kali. **Bukan bug baru** — bug LATEN migrasi
0019 (`transaction_note_not_null`, JAUH SEBELUM sesi ini): rename
`transactions`→`transactions_old` lalu rebuild, TAPI TIDAK ikut
merebuild 3 tabel yang FK-nya menunjuk situ (`transaction_attachments`,
`debts`, `debt_payments`) — SQLite tidak mengikuti rename pada FK
tabel LAIN. Baru KETAHUAN sekarang karena `insertArApTransaction`
adalah kode pertama yang insert `debts` sejak migrasi 0019.

**Efek samping**: 2 transaksi (`transactions`) sempat ter-insert
SEBELUM error (exception di tengah `applyDebtTransaction`), jadi
tercatat "yatim" tanpa `debts` pasangannya — DAN `isArApRowSynced`
(cuma cek `transactions.source_ref`) menganggap sudah tersinkron,
TIDAK retry otomatis.

**Perbaikan**: migrasi `0022_fix_transactions_old_fk.sql` (rebuild 3
tabel dg FK benar, pola rename-semua-dulu dari migrasi 0009) —
DIUJI DULU terhadap SALINAN db sebelum disarankan (row count utuh, FK
check bersih, simulasi insert berhasil), lalu diterapkan via restart
app user. 2 transaksi yatim (id 5565/5566 di dev.db) DIHAPUS MANUAL
(app ditutup dulu, dikonfirmasi tidak ada `debts` terkait) — user
sync ulang, kali ini `debts`/`debt_payments` tercatat BENAR (piutang
Rp 2.000 teralokasi FIFO ke debt tertua id 11, status tetap `ongoing`
krn partial; utang baru Rp 1.500 tercatat sbg `debts` baru).

### Status akhir — PENTING, JANGAN LEWATKAN

User eksplisit menyatakan **"masih belum bisa dikatakan oke"** di
akhir sesi, TANPA merinci alasan di percakapan ini. Semua yang
DITEMUKAN sebagai bug sejauh ini SUDAH diperbaiki+diverifikasi (lihat
di atas) — jadi ini KEMUNGKINAN BESAR soal perilaku/desain yang perlu
didiskusikan ulang, BUKAN bug teknis tersisa. Dokumen plan sudah
mencatat kandidat topik dugaan (FIFO vs urutan riil per pihak, kontak
generik vs per-pihak individual, konfigurasi akun "Bisnis" yang sama
utk piutang&utang) — **SEMUA berlabel DUGAAN, tanyakan langsung ke
user di sesi lanjutan, JANGAN diasumsikan sebagai jawaban pasti**.

## Lanjut sesi berikutnya

1. **WAJIB LEBIH DULU**: tanya user apa PERSIS yang membuat AR/AP
   "belum oke" — jangan mulai dari asumsi di dokumen plan.
2. Migrasi `hooks/use-entity-form.ts` lama → versi baru — masih
   terbuka dari handover-handover sebelumnya, belum disentuh lagi
   sesi ini juga.
3. Mode ketiga (breakdown PPOB/Consignment, `retailku-sale-category-mapping.md`) —
   masih ditunda sejak sesi 2026-09-23, belum disentuh sesi ini.
4. Pengukuran performa nyata `get_cashflow_detail` yang diperluas
   (query tambahan `accountMapping.findMany` + filter akun lebih
   banyak) — BELUM di-`EXPLAIN ANALYZE`, cek kalau toko produksi
   py riwayat piutang/utang panjang.
