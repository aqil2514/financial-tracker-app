# Retailku Transaction Picker — Dialog Pilih Data Retailku untuk Prefill Transaksi

## Status & TODO saat ini (ringkas)

Rancangan konsep awal dari diskusi 2026-10-22, menggantikan pendekatan sync otomatis lama (`features/retailku/shared/sync/cashflow/**`) yang dianggap tidak efisien — lihat bagian "Latar belakang" untuk alasan lengkapnya. Desain konkretnya BANYAK berubah dari rancangan awal seiring diskusi berlanjut — lihat "Konsep final (2026-10-23)" di bawah, bagian "Konsep awal (historis)" dipertahankan apa adanya sebagai jejak keputusan, bukan lagi rancangan yang berlaku.

- [x] Infrastruktur MCP client direfactor total (`shared/retailku/helpers/connection`, `helpers/tools`, `hooks/use-retailku-mcp-client`) — kode lama dipindah ke `helpers/tools/legacy/`.
- [x] Dialog "Ambil dari Retailku" dua step dalam satu dialog: step 1 (`components/left-side`, `components/right-side`) pilih tool → list → detail; step 2 (`components/mapping-step`) petakan jadi satu/lebih draft transaksi siap diedit & disimpan.
- [x] Kontrak registry per-tool (`registry/types.ts`: `RetailkuToolEntry` — `fetchList`, `fetchDetail`, `adapter`, `toPackage`).
- [x] Proof-of-concept tool pertama: `get_cash_opname_list`/`get_cash_opname_detail` (Cash Opname) — `registry/get-cash-opname.ts`. `toPackage` menghasilkan draft `target: "transaction"` dari `difference` (kalau tidak nol) + draft `target: "third-party-fund"` per `thirdPartyFunds[i]`.
- [x] Step 2 pakai field form ASLI (bukan field baru/preview read-only) — `TransactionEntryForm`/`ThirdPartyFundEntryForm` di `components/mapping-step/`, field-field yang sama persis dengan form Tambah Transaksi/Dana Pihak Ketiga, dilepas dari bungkus submit-nya sendiri.
- [x] Submit "Simpan Semua" — `useSavePackage` insert tiap entri berurutan lewat `createTransaction`/`createDirectThirdPartyFund` (fungsi murni yang sudah ada, `createDirectThirdPartyFund` diekstrak dari `use-create-third-party-fund.ts` supaya reusable).
- [x] Diverifikasi nyata di `finance.dev.db` (`docs/rules/checking-dev-database.md`) 2026-10-23 — 3 baris `transactions` + 2 baris `third_party_funds` turunan, semua field & FK benar.
- [ ] Dipakai nyata beberapa hari dulu sebelum menambah tool lain atau fitur lanjutan (konfigurasi default kategori/akun).
- [ ] Setelah terbukti jalan: evaluasi apakah kode sync lama (`features/retailku/shared/sync/cashflow/**`, proses background, kolom `source`/`source_ref` di `transactions`) dihapus.
- [ ] (Ditunda, bukan scope awal) Konfigurasi default kategori/akun per-tool atau per-sourceType, disimpan sebagai config — baru dipertimbangkan setelah alur dasar terbukti jalan beberapa hari.
- [ ] 4 file di `hooks/` (`use-retailku-payment-accounts.ts`, `use-retailku-mapping-issues.ts`, `use-retailku-account-mapping.ts`, `use-field-mapping.ts`) masih belum diaudit/didokumentasikan — kandidat dihapus begitu kode sync lama dipastikan tidak dipakai lagi.

## Latar belakang

Dicatat juga di `apps/desktop/docs/todos/plan/cloud-sync-retailku-provenance-gap.md` (dokumen terpisah, soal gap provenance `source`/`source_ref` di jalur cloud-sync) — dokumen itu membahas bug di desain LAMA, dokumen ini membahas rombakan konsepnya.

Fitur sync Retailku -> Desktop yang ada sekarang (`features/retailku/shared/sync/cashflow/**`, status "done" di `docs/todos/done/retailku-cashflow-sync.md`) berjalan sebagai proses sinkronisasi otomatis: menarik data `get_cashflow_detail` dari Retailku (yang sebenarnya per-transaksi/per jurnal kas, lihat `source-ref` seperti `"SL-260901-01"`), lalu MENGAGREGASI jadi satu baris transaksi per hari (mode "summary", note generik `"Ringkasan Kas Harian Retailku — {accountName}"`) atau per hari+sourceType (mode "detail", note `"Kas Harian Retailku — {accountName} — {sourceType}"`).

Setelah dipakai beberapa minggu, user berhenti memakai sync otomatis ini (baris `source='retailku_sync'` terakhir di production D1 tanggal 2026-10-03, sejak itu nihil) dan beralih ke input manual, karena detail hasil sync dianggap kurang — note generik tidak menangkap detail per-item/transaksi yang didapat kalau diinput manual (lihat perbandingan nyata di production: baris manual seperti `"Permen Kopiko 5 Pack"`, `"Minyak Wangi Roll On 12pcs"` vs baris sync `"Omzet Dagang"`/ringkasan harian).

User menilai desain lama ini "tidak efisien" dan ingin dirombak total, bukan sekadar diperbaiki granularitasnya.

## Konsep final (2026-10-23)

### Titik integrasi: tetap dialog, bukan field form, bukan proses background

Ini tidak berubah dari konsep awal — lihat "Titik integrasi" di bagian "Konsep awal (historis)" di bawah, masih berlaku apa adanya.

### Dua step dalam SATU dialog, bukan satu alur linear ke dialog lain

Rancangan awal membayangkan "klik Pakai → dialog Retailku tutup → dialog Tambah Transaksi terbuka ter-prefill", dengan asumsi implisit SATU item Retailku = SATU transaksi. Asumsi itu salah untuk banyak kasus nyata — satu Cash Opname bisa menghasilkan satu transaksi penyesuaian kas DAN beberapa baris Dana Pihak Ketiga sekaligus (lihat data produksi "Warung Aqil", hampir selalu ada beberapa dana pihak ketiga tercampur per opname); laporan penjualan tipe PPOB disebutkan user butuh dua entri sekaligus (transfer HPP + income margin) walau belum diimplementasikan.

Desain final: dialog yang sama berganti ISI PENUH antara dua step (`shared/retailku/components/context.tsx`, state `step: "browse" | "map"`), bukan membuka dialog form terpisah:

- **Step 1 (`browse`)** — `LeftSide`/`RightSide`, sama seperti rancangan awal: pilih tool → list → detail ringkas. Tombol "Pakai Data Ini" di `RightSide` pindah ke step 2, BUKAN membuka dialog lain.
- **Step 2 (`map`)** — `MappingStep`. Detail item diterjemahkan (`tool.toPackage(detail)`) jadi array entri (`RetailkuPackageEntry[]`, `registry/types.ts`), tiap entri jadi satu tab. Satu tombol "Simpan Semua" di luar semua tab, insert SEMUA entri yang valid sekaligus secara berurutan.

### Step 2 pakai field form LENGKAP yang bisa diedit, bukan preview read-only, bukan field baru

Perubahan besar lain dari rancangan awal ("field yang diprefill secara umum: nama/deskripsi dan nominal saja... field lain TIDAK diprefill"): setelah dibahas ulang, keputusan itu dianggap terlalu membatasi untuk jangka panjang (kategori/label/debt/investment semua bisa `null`/kosong secara sistem, user tetap perlu kuasa penuh mengisi/mengedit, bukan cuma terima apa adanya dari prefill).

Desain final mengadopsi SCHEMA form Tambah Transaksi/Dana Pihak Ketiga sepenuhnya, bukan kontrak prefill sendiri:

- `toPackage(detail)` di tiap tool registry menghasilkan `RetailkuPackageEntry[]` — tiap entri `{id, label, target: "transaction" | "third-party-fund", defaultValues: Partial<TransactionFormValues> | Partial<ThirdPartyFundFormValues>}`. `defaultValues` HANYA nilai awal (field yang tidak diketahui dibiarkan default form asli), bukan hasil akhir siap-insert.
- Tiap tab di step 2 merender field FORM ASLI (bukan versi ringkas baru): `TransactionEntryForm`/`ThirdPartyFundEntryForm` (`components/mapping-step/`) memakai field-field yang SAMA PERSIS dengan `TransactionFormWithBaseForm`/`ThirdPartyFundForm`, cuma dilepas dari bungkus `<form>`/tombol submitnya sendiri (field-field itu sendiri TIDAK ditulis ulang).
- User BISA mengedit field apa pun di tiap tab (kategori, akun, label, dll) sebelum submit — bukan preview read-only, bukan prefill-lalu-pindah-dialog.
- Nilai live tiap tab dilaporkan ke `MappingStep` lewat `useWatch` + `schema.safeParse` (pola yang sama dengan `useGenericMappingForm`, fitur sync lama yang masih ada di `features/retailku/mapping/`) — valid → objek siap insert, invalid → `null`. Tombol "Simpan Semua" aktif hanya kalau SEMUA entri valid.

### `target` menandai FORM UI, bukan tujuan data yang berbeda

Sempat ada kesalahpahaman di tengah diskusi bahwa "target transaksi" vs "target dana pihak ketiga" berarti dua jalur data yang berbeda. Setelah ditelusuri (`features/transactions/form/add-edit/hooks/create-transaction/**`, `shared/third-party-funds/apply-third-party-transaction.ts`), ternyata SEMUA jalur — termasuk debt dan investment — pada akhirnya sama-sama insert ke `transactions` lebih dulu, baru dipanggil fungsi `applyXxxTransaction` sesuai domain (`applyDirectDebtTransaction`, `applyInvestmentTransaction`, `applyDirectThirdPartyTransaction`, dst) yang bikin baris turunan. Form Dana Pihak Ketiga BUKAN jalur data terpisah, cuma UI/UX yang lebih ringkas untuk kasus itu.

Jadi `target` di `RetailkuPackageEntry` murni menandai KOMPONEN FORM UI mana yang dipakai render tab, bukan "tabel tujuan" — piutang/utang dan investasi tidak butuh `target` baru sendiri, cukup `target: "transaction"` dengan `defaultValues.type`/`account_id`/`transfer_account_id` yang membuat form transaksi otomatis menampilkan field debt/investment yang sesuai.

### Submit: fungsi murni yang sudah ada, bukan ditulis ulang

Tidak ada logic insert baru — "Simpan Semua" (`components/mapping-step/use-save-package.ts`) memanggil `createTransaction(values)` (`features/transactions/.../create-transaction/`, sudah ada) dan `createDirectThirdPartyFund(values)` (`shared/third-party-funds/`, diekstrak dari `use-create-third-party-fund.ts` 2026-10-23 supaya bisa dipanggil programatik di luar hook form — `use-create-third-party-fund.ts` sekarang memanggil fungsi ini juga, tidak ada duplikasi). Insert berurutan (bukan `Promise.all`) per entri yang valid, supaya kalau satu gagal di tengah, sisanya tidak lanjut sembarangan.

### Sumber data, strategi rollout, nasib kode lama

Tidak berubah dari konsep awal — lihat bagian terkait di "Konsep awal (historis)" di bawah.

## Konsep awal (historis, 2026-10-22)

Bagian di bawah ini dipertahankan sebagai jejak diskusi awal — SUDAH BANYAK DIGANTIKAN oleh "Konsep final" di atas (khususnya soal field yang diprefill, dan alur satu-dialog-ke-dialog-lain). Baca "Konsep final" dulu untuk tahu apa yang benar-benar berlaku.

### Titik integrasi: dialog, bukan field form, bukan proses background

Bukan proses sync otomatis yang menulis langsung ke `transactions` di belakang layar. Bukan juga field tambahan di dalam form "Tambah Transaksi" yang sudah ada. Titik integrasinya adalah **dialog baru** di halaman Transaksi (tombol baru, berdampingan dengan tombol "+ Tambah Transaksi" yang sudah ada), yang **menjembatani** ke dialog "Tambah Transaksi" yang sudah ada lewat prefill — form itu sendiri tetap satu-satunya jalur tulis ke `transactions`.

### Alur dialog

1. User klik tombol "Ambil dari Retailku" di halaman Transaksi -> dialog terbuka.
2. User pilih salah satu tool MCP Retailku read-only yang relevan dengan transaksi (daftar tools belum diputuskan, lihat TODO).
3. Tool dijalankan -> dialog menampilkan list hasil (mis. list PO hari ini).
4. User klik salah satu item di list -> tampil detail item itu.
5. User klik tombol "Pakai" (atau sejenis) di detail -> dialog Retailku tertutup, dialog "Tambah Transaksi" terbuka, dengan field yang relevan sudah terisi (prefill) dari detail item tadi.
6. User tetap bisa mengedit field apa pun sebelum submit -- prefill cuma mempercepat pengisian, bukan auto-submit.

### Arsitektur UI: sebisa mungkin generik, mirip pola `FilterPanel`

Belum ada gambaran konkret (belum didesain), tapi arahnya: dialog ini sebisa mungkin dibangun **generik**, bukan satu dialog baru per-tool. Analoginya mirip sistem filter yang sudah ada di proyek ini (`components/query/filters/panel/**`, lihat README di folder itu) -- provider + shell popover/dialog yang generik dan sama persis untuk semua tool, sementara konten tiap step (pilih tool, list, detail) di-render berdasarkan registrasi config per-tool, bukan ditulis ulang per-tool dari nol. Komponen per-tool (list/detail) tetap **controlled** (terima data+callback lewat props, tidak baca context langsung) -- pola yang sama dgn `FilterText`/`FilterSelect` di sistem filter, supaya gampang diuji/dipakai terpisah. Detail bentuk registry/interface-nya BELUM diputuskan -- ini baru arah umum, didetailkan nanti pas mulai implementasi tool pertama.

### Mapping / prefill

Field yang diprefill secara umum: **nama/deskripsi** dan **nominal** saja. Field lain (akun, kategori, kontak, label) TIDAK diprefill -- tetap keputusan manual user tiap kali, karena itu klasifikasi subjektif yang tidak bisa ditebak dari data POS.

Karena tiap tool MCP Retailku punya bentuk data (shape) yang berbeda-beda, mapping dari hasil tool ke field form **tidak digeneralisasi otomatis** -- tiap tool butuh adapter sendiri yang menerjemahkan hasil tool itu ke kontrak prefill yang seragam (nama, deskripsi, nominal, dan kasus khusus kalau ada). Transfer internal adalah salah satu kasus khusus yang perlu mapping tersendiri (bukan sekadar nominal+note, kemungkinan perlu akun asal+tujuan).

### Sumber data

Panggil langsung tools MCP Retailku yang sudah ada (lihat `src/shared/retailku/mcp-tools/**`), bukan lewat jalur fetch+agregasi custom seperti desain lama (`fetch-all-cashflow-detail-rows.ts` + `aggregate-by-date-*.ts`).

### Strategi rollout

Mulai dari satu tool dulu (proof of concept) -- end-to-end: pilih tool -> list -> detail -> prefill -> submit manual, untuk SATU tool saja. Dipakai nyata beberapa hari dulu sebelum menambah tools lain atau mempertimbangkan fitur lanjutan (konfigurasi default kategori/akun per-tool).

### Nasib kode lama

`features/retailku/shared/sync/cashflow/**` (proses sync otomatis, agregasi harian) kemungkinan DIHAPUS, tapi baru setelah desain baru ini terbukti matang -- jangan dihapus duluan sebelum penggantinya benar-benar dipakai harian. Kolom `source`/`source_ref` di `transactions`/`debts`/`debt_payments` (lihat `cloud-sync-retailku-provenance-gap.md`) kemungkinan juga jadi tidak relevan lagi kalau kode lama dihapus -- perlu dipikir ulang saat itu tiba, bukan sekarang.

## Belum diputuskan

- Tool berikutnya setelah Cash Opname (kandidat yang pernah disebut: `get_fund_transfer_list` untuk transfer internal, `get_sale_list`/`get_sales_by_type` untuk laporan penjualan — PPOB disebutkan butuh 2 entri sekaligus/transfer HPP+income margin, penjualan dagang/produksi biasa cukup 1 entri, belum diimplementasikan).
- Apakah tool dengan draft BANYAK sekali per item (laporan penjualan harian bisa puluhan transaksi) tetap cocok dengan pola tab `MappingStep` yang sama, atau butuh pola UI berbeda.
- Apakah dialog ini reusable dari halaman lain (mis. halaman Dana Pihak Ketiga) atau khusus halaman Transaksi saja.
- Duplikasi query list (`ResultList`/`RightSide` sama-sama panggil `fetchList` dengan key sama, dedupe oleh React Query tapi definisinya terduplikasi di 2 file) — belum diekstrak ke hook bersama, dicatat juga di README masing-masing folder.

## Terkait

- `apps/desktop/docs/todos/plan/cloud-sync-retailku-provenance-gap.md` -- gap provenance di desain LAMA (cloud-sync `source`/`source_ref`), jadi kemungkinan tidak relevan lagi kalau kode lama dihapus sesuai rencana di sini.
- `docs/todos/done/retailku-cashflow-sync.md` -- desain & implementasi sync otomatis lama yang mau digantikan.
- `src/shared/retailku/registry/**` -- registry per-tool (`fetchList`, `fetchDetail`, `adapter`, `toPackage`), jembatan antara `helpers/tools/` dan `components/`.
- `src/shared/retailku/helpers/tools/**` -- tools MCP Retailku read-only (tool aktif di root, kode lama dipindah ke `legacy/`), sumber data picker ini.
- `src/shared/retailku/components/**` -- UI dialog dua-step, lihat README di tiap sub-folder untuk detail per komponen.
