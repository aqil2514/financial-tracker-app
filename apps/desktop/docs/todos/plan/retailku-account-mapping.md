# Persistensi Mapping Akun Retailku (SELESAI)

> Lanjutan dari `retailku-integration.md` (status: DONE untuk fondasi
> koneksi/MCP client/UI mapping tampilan). Dokumen ini fokus HANYA pada
> satu hal: menyimpan pilihan mapping akun Retailku → akun lokal secara
> permanen, supaya tidak hilang tiap refresh halaman.
>
> **Status: SELESAI** — persistensi, badge orphan, dan prefetch
> best-effort semuanya sudah diimplementasikan dan diverifikasi
> (`tsc`/`npm test` 94/94/`npm run build` bersih). Satu-satunya yang
> sengaja BELUM dikerjakan (titik 2, point-of-use) ditunda ke saat sync
> utang-piutang/cashflow dibangun, dicatat di TODO paling bawah.

## Konteks

`features/retailku/account-mapping-list.tsx` menampilkan tabel akun
Retailku (`isPaymentMethod: true`, diambil live via MCP
`get_finance_accounts`) berdampingan dengan combobox akun kas lokal
`financial-app`. Untuk Warung Aqil, cuma 2 baris: "Kas Tunai" (code
1101) dan "Seabank" (code 1102).

## TODO

- [x] Migrasi SQL — tabel `retailku_account_mapping`
      (`src-tauri/migrations/0016_retailku_account_mapping.sql`,
      registrasi versi 16 di `migrations.rs`). Diverifikasi
      `PRAGMA foreign_key_check` bersih terhadap salinan `finance.dev.db`.
- [x] Hook `useRetailkuAccountMapping()` (baca) dan
      `useSaveRetailkuAccountMapping()` (simpan — `UPSERT` by
      `retailku_account_id` lewat `ON CONFLICT ... DO UPDATE`, bukan
      insert baru tiap kali re-mapping) di
      `shared/retailku/use-retailku-account-mapping.ts`, diekspor dari
      `shared/retailku/index.ts`.
- [x] `account-mapping-list.tsx` disambungkan ke hook di atas — draft
      di `useState` di-hydrate SEKALI dari data tersimpan (flag
      `hydrated`, supaya tidak tertimpa balik saat query di-invalidate
      setelah save), tombol "Simpan Mapping" dengan indikator
      `isPending`.
- [x] Dropdown akun lokal diganti dari `Select` ke `Combobox` (Base UI,
      primitif yang sama dipakai `FormFieldCombobox` di form transaksi)
      — searchable, konsisten dengan combobox akun lain di app. Baris
      diekstrak ke komponen `AccountMappingRow` tersendiri karena
      `useComboboxAnchor()` (hook) tidak boleh dipanggil di dalam
      `.map()`.
- [x] Badge orphan di `account-mapping-list.tsx` — mapping tersimpan
      yang akun Retailku-nya sudah tidak lagi `isPaymentMethod: true`
      ditampilkan sebagai baris terpisah dengan badge merah "Tidak
      aktif di Retailku" (dihitung dari selisih `savedMapping` vs
      `retailkuAccounts`, tidak perlu request tambahan).
- [x] Prefetch best-effort (titik 1, "saat app dibuka") — `AppSidebar`
      memanggil `useRetailkuPaymentAccounts()` (sudah `enabled` cuma
      saat kredensial lengkap, react-query diam saja kalau
      offline/gagal) supaya data akun Retailku sudah fresh di cache
      sebelum user sempat membuka halaman mapping.
- [x] **(Tambahan di luar scope awal, diminta menyusul)** Badge koneksi
      di halaman daftar akun (`master-data/accounts` →
      `features/accounts/sections/list/content/item.tsx`) — akun lokal
      yang jadi tujuan satu atau lebih mapping menampilkan badge
      "Retailku: <nama akun Retailku>" (gabungan semua nama kalau lebih
      dari satu akun Retailku mengarah ke akun lokal yang sama, mis.
      "Kas Tunai" + "Seabank" → "Dompet Bisnis").
- [ ] (Ditunda ke saat sync utang-piutang/cashflow dibangun, dicatat di
      sini supaya tidak terlupa) Validasi ulang `isPaymentMethod`
      sebelum sync memakai suatu mapping (titik 2, point-of-use —
      defense in depth, lihat "Stabilitas `retailku_account_id`").

## Kebutuhan skema

Tabel baru `retailku_account_mapping`:

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | INTEGER PK | |
| `retailku_account_id` | TEXT | UUID akun dari Retailku (`id` di `RetailkuFinanceAccount`), stabil per akun |
| `retailku_account_code` | TEXT | Snapshot `code` saat mapping dibuat — buat ditampilkan tanpa perlu panggil MCP ulang, dan sebagai jejak kalau code berubah di sisi Retailku |
| `retailku_account_name` | TEXT | Snapshot `name`, alasan sama seperti `code` |
| `local_account_id` | INTEGER | FK ke `accounts.id` |
| `created_at` / `updated_at` | TEXT | pola timestamp yang sudah dipakai tabel lain |

Constraint: `UNIQUE(retailku_account_id)` — satu akun Retailku cuma
boleh mapping ke satu akun lokal (tapi satu akun lokal boleh menerima
mapping dari beberapa akun Retailku, mis. "Kas Tunai" dan "Seabank"
sama-sama diarahkan ke "Dompet Bisnis" lokal).

**Diputuskan: `local_account_id` pakai `ON DELETE RESTRICT`** — hapus
akun lokal diblokir kalau masih dipakai sebagai tujuan mapping, user
harus ubah/hapus mapping dulu. Konsisten dengan pola "jangan biarkan
integritas data rusak diam-diam" (mis. proteksi hapus kategori yang
masih dipakai transaksi) — dipilih daripada `CASCADE` supaya user tidak
tanpa sadar mematikan integrasi cuma karena beres-beres akun lama.

**Re-mapping (ganti akun lokal tujuan untuk akun Retailku yang sama)**
harus `UPDATE`/`UPSERT` baris yang sudah ada (by `retailku_account_id`,
yang `UNIQUE`), BUKAN insert baris baru — constraint unique di atas
sudah menegakkan ini di level skema, hook simpan tinggal pakai
`INSERT ... ON CONFLICT (retailku_account_id) DO UPDATE`.

`local_account_id` sebaiknya divalidasi (minimal di level aplikasi saat
simpan) supaya cuma bisa menunjuk akun dengan `account_type = 'cash'`
— lihat "Kaitan dengan `account_type`" di bawah untuk alasannya.

## Kaitan dengan `account_type`

`accounts.account_type` di `financial-app` cuma punya 2 nilai: `"cash"`
dan `"debt"` (lihat `lib/db.ts`). Ini paralel dengan flag
`isPaymentMethod` di Retailku:

| | Akun "uang sungguhan" | Akun akuntansi murni (bukan tempat uang) |
|---|---|---|
| **Retailku** | `isPaymentMethod: true` (mis. Kas Tunai, Seabank) | `isPaymentMethod: false` (mis. HPP, Persediaan, Piutang Dagang) |
| **`financial-app`** | `account_type: "cash"` | `account_type: "debt"` (akun utang/piutang, bukan tempat uang) |

Jadi mapping akun HARUS hanya terjadi antara `isPaymentMethod: true`
(Retailku) ↔ `account_type: "cash"` (lokal) — `account-mapping-list.tsx`
sudah memfilter dropdown ke `account_type === "cash"`, ini SUDAH BENAR,
tidak perlu diubah.

## Stabilitas `retailku_account_id`

Dicek ke source `retail-multitenant` (bukan cuma skema, tapi logic
hapus/nonaktifkan akun sungguhan) untuk memastikan skenario mana yang
REALISTIS terjadi, bukan cuma teoretis:

- **Akun benar-benar hilang (hard delete) — TIDAK MUNGKIN untuk akun
  payment method aktif.** `delete-finance-accounts.ts`
  (`validateAccountBeforeDelete`) memblokir hapus kalau akun sudah
  punya histori transaksi (`JournalItem`) — dan akun payment method
  yang sudah dipakai (seperti "Kas Tunai"/"Seabank") pasti sudah punya
  transaksi. Bahkan soft-delete (`deletedAt`) pun diblokir untuk kasus
  ini. Akun finance memang pondasi struktural di Retailku, jadi
  skenario "akun hilang total" ini benar kemungkinannya sangat kecil.
- **`code`/`name` berubah, `id` tetap** (mis. "Kas Tunai" di-rename) —
  TIDAK masalah, `local_account_id` merujuk ke `retailku_account_id`
  (UUID), bukan ke `code`/`name`. Snapshot `code`/`name` di skema di
  atas cuma buat tampilan, mapping-nya tetap valid.
- **`isPaymentMethod` diubah jadi `false` — INI SKENARIO YANG NYATA
  DAN RELEVAN.** Dicek ke `pm-deactivate.helper.ts`
  (`deactivatePaymentMethod`): "nonaktifkan metode pembayaran" untuk
  akun yang SUDAH punya transaksi (kasus normal untuk akun yang sedang
  dipakai) BUKAN menghapus akunnya — cuma set `isPaymentMethod: false`.
  Akun (`id`-nya) tetap ada di database Retailku, TAPI tidak lagi
  lolos filter `isPaymentMethod: true` yang dipakai
  `get_finance_accounts`/UI mapping ini. Konsekuensinya:
  `retailku_account_mapping` lokal masih menyimpan `id` itu sebagai
  mapping aktif, padahal sisi Retailku sudah tidak menganggapnya
  payment method lagi — kalau sync nanti tidak memvalidasi ulang,
  transaksi bisa tetap "mengalir" ke mapping yang sudah dinonaktifkan
  user di Retailku tanpa ada yang sadar.

Konsekuensi: poin todo "perilaku mapping orphan" fokusnya BUKAN "akun
hilang" (kemungkinannya kecil), tapi **deteksi
`isPaymentMethod: false`**.

**Keputusan trigger validasi** (dibahas terpisah dari desain skema
mapping): validasi dilakukan di 2 titik, sama-sama TIDAK MEMBLOKIR apa
pun kalau gagal/offline (menjaga prinsip offline-first di
`retailku-integration.md` — app harus tetap 100% jalan tanpa internet):

1. **Best-effort saat app dibuka, non-blocking** — begitu app start
   DAN kebetulan online DAN Retailku terkoneksi, cek status mapping
   diam-diam di background (tidak menunda render apa pun). Offline
   atau gagal → diabaikan saja, dicoba lagi di sesi berikutnya. Kalau
   ketemu mapping yang akunnya sudah `isPaymentMethod: false`,
   tampilkan badge/notifikasi supaya user tahu LEBIH DINI, bukan
   nunggu ketahuan pas sync jalan/gagal.
2. **Validasi ulang saat sync benar-benar berjalan** (point-of-use,
   defense in depth) — sebelum sync memasukkan transaksi ke akun dari
   suatu mapping, cek ulang `isPaymentMethod` akun itu. Kalau sudah
   `false`, skip baris itu + catat sebagai butuh perhatian user,
   jangan diam-diam tetap dipakai.

Titik (1) TIDAK menggantikan (2) — keduanya jalan bersamaan: (1) untuk
feedback dini yang nyaman, (2) sebagai pengaman terakhir yang tidak
bergantung pada user sempat melihat notifikasi app-startup atau tidak.

## Di luar cakupan dokumen ini

Pemanggilan `get_cashflow_allocation`, agregasi harian per
`sourceType`, kolom `source`/`source_ref` di `transactions`, dan
trigger/jadwal sync — semua itu BUTUH mapping akun ini sebagai
prasyarat, tapi didesain di dokumen terpisah setelah mapping ini beres.

## Catatan eksplorasi: kaitan dengan utang-piutang (untuk dokumen sync terpisah nanti)

Ditemukan saat membahas dokumen ini, DICATAT untuk dokumen sync
utang-piutang yang akan dibuat terpisah — bukan bagian dari scope
dokumen ini:

- Retailku punya MCP tool `get_ar_ap` yang fungsinya analog dengan
  fitur debt/receivable `financial-app` — per pihak (customer/supplier),
  `outstandingReceivable`/`outstandingPayable`, gabungan trade +
  non-trade. Bentuk datanya HANYA `{id, name, type,
  outstandingReceivable, outstandingPayable, hasOpen}` — TIDAK ada
  field akun kas/bank sama sekali.
- Retailku juga punya akun COA khusus utang-piutang (`TRADE_RECEIVABLE`
  1500, `SUPPLIER_RECEIVABLE` 1700, `OTHER_RECEIVABLE` 1800,
  `ACCOUNTS_PAYABLE` 2100, `OTHER_PAYABLE` 2200) — semuanya
  `isPaymentMethod: false`, level akuntansi (COA) untuk jurnal, bukan
  payment method. Keinginan user: bukan dipetakan satu-satu, cukup
  disederhanakan jadi 2 kelompok gabungan (piutang gabungan, utang
  gabungan) — `get_ar_ap` sudah otomatis mengagregasi ke level pihak,
  jadi ini sudah cenderung terpenuhi tanpa langkah tambahan.
- **Temuan penting**: di `financial-app`, `debts`/`debt_payments`
  BUKAN entitas berdiri sendiri — setiap barisnya WAJIB berasal dari
  satu baris `transactions` nyata (`applyDebtTransaction`/
  `applyDebtTransactionEdit` di `shared/debts/apply-debt-transaction.ts`).
  Piutang baru = transaksi transfer `cash→debt`, pelunasan = transaksi
  transfer `debt→cash`. Konsekuensinya: sync utang-piutang Retailku
  TIDAK BOLEH `INSERT INTO debts` langsung — harus lewat jalur yang
  sama seperti input manual (buat `transactions` dulu, `debts` sebagai
  efek samping), supaya tidak merusak mekanisme cicilan/edit yang
  sudah ada. Ini artinya account mapping (dokumen ini) TETAP jadi
  prasyarat sync utang-piutang, bukan cuma untuk cashflow.
- Keputusan yang sudah disepakati untuk sync nanti: piutang gabungan
  dan utang gabungan dari Retailku memakai **dua kontak lokal
  terpisah** (bukan satu kontak generik untuk kedua arah).
- Yang BELUM dibahas (sengaja ditunda ke dokumen sync tersendiri):
  bagaimana `debtAction` diisi otomatis oleh proses sync, dan bagaimana
  re-sync/edit ulang ditangani.
- ~~Kasus khusus PPOB (satu transaksi asal → dua baris berbeda, HPP
  Harian Digital dan Margin Harian Digital)~~ **SUDAH DICEK & DIJAWAB**
  di `retailku-cashflow-sync.md` (bagian "Kasus PPOB") — asumsi "2 baris
  HPP vs Margin" di atas TIDAK AKURAT, dicek dari data nyata
  (`get_sale_detail`/`get_journal_detail` transaksi PPOB real) ternyata
  4 baris jurnal (Piutang Dagang, HPP PPOB, Pendapatan PPOB, akun kas
  provider keluar). Kesimpulan: PPOB TIDAK butuh penanganan khusus di
  `financial-app` — piutangnya diperlakukan sama seperti piutang
  penjualan retail biasa lewat `get_ar_ap`, kas-nya sudah otomatis benar
  lewat `get_cashflow_summary`/`get_cashflow_detail` tanpa perlu tahu
  ini PPOB. Trade-off yang diterima: cashflow & pelunasan piutang PPOB
  bisa tercatat di tanggal berbeda sebagai dua baris kas terpisah
  (tidak "menyatu" jadi satu cerita untung-rugi) — lihat detail lengkap
  di dokumen sync.
