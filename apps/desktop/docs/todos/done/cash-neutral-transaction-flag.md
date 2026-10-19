# Penanda Transaksi Non-Kas (Cash-Neutral) di Laporan — SELESAI

## Status & TODO saat ini (ringkas)

Penjelasan lengkap tiap poin ada di bagian "Latar belakang" dan "Rancangan" di bawah — BACA DULU sebelum menulis kode apa pun di sini, terutama bagian "Kenapa BUKAN berdasarkan `account_type`" karena ini kesalahpahaman yang sempat muncul di diskusi awal.

- [x] Gap ditemukan & cakupannya diaudit (2026-10-16) — hampir semua laporan (Kalender, Dashboard, Laporan, MCP) tidak membedakan transaksi kas riil vs non-kas.
- [x] Definisi "non-kas" diputuskan (2026-10-16) — per TRANSAKSI, bukan per tipe akun, lihat "Kenapa BUKAN berdasarkan `account_type`".
- [x] Desain skema kolom baru diputuskan (2026-10-16) — `is_cash_neutral INTEGER NOT NULL DEFAULT 0`, boolean sederhana (bukan enum/reason), lihat "Rancangan" untuk alasan pemilihan nama & tipe.
- [x] Audit lengkap titik insert di luar jalur form normal selesai (2026-10-16) — lihat "Titik insert transaksi penutup", semua kandidat terverifikasi terhadap kode saat ini.
- [x] Keputusan koreksi saldo (`use-correct-account-balance.ts`) diambil (2026-10-16) — akun Utang/Piutang & Investasi otomatis `is_cash_neutral=1` tanpa tanya, akun Kas user pilih sendiri lewat opsi di form (lihat "Koreksi saldo — keputusan per tipe akun").
- [x] Migrasi SQLite ditulis & diverifikasi (2026-10-19) — [0052_transaction_cash_neutral_flag.sql](../../../src-tauri/migrations/0052_transaction_cash_neutral_flag.sql), `ALTER TABLE transactions ADD COLUMN is_cash_neutral INTEGER NOT NULL DEFAULT 0`. Diverifikasi 2 arah: (1) test Rust `cargo test migrations` (10/10 lolos, termasuk assertion baru kolom ini di `skema_akhir_punya_tabel_dan_kolom_inti`), (2) diterapkan ke COPY `finance.dev.db` nyata (bukan file asli) — 5620 baris `transactions` existing, semua jadi `is_cash_neutral=0`, `PRAGMA integrity_check`/`foreign_key_check` bersih.
- [x] Registrasi migrasi baru di `migrations.rs` — selesai (2026-10-19), version 52.
- [x] Titik insert transaksi penutup (write-off debt, write-off investasi, pelunasan non-cash) di-set `is_cash_neutral=1` (2026-10-19) — [use-write-off-debt.ts](../../../src/shared/debts/use-write-off-debt.ts), [apply-write-off-investment-transaction.ts](../../../src/shared/investments/apply-write-off-investment-transaction.ts), [use-pay-debt.ts](../../../src/shared/debts/pay-debt-form/use-pay-debt.ts) (cabang `non_cash` + `debt.account_id` terisi saja). Jalur normal (`insert-to-db.ts`) TIDAK disentuh — otomatis pakai default `0` dari skema. Koreksi saldo (`use-correct-account-balance.ts`) BELUM termasuk di sini — itu poin 5 di bawah, butuh field form baru dulu, bukan sekadar tambah `1` ke SQL.
- [x] Toggle "Hitung sebagai transaksi kas?" di form Koreksi Saldo (2026-10-19) — muncul HANYA untuk akun `cash`, otomatis `is_cash_neutral=1` tanpa UI untuk `debt`/`investment`. Lihat [schema.ts](../../../src/features/accounts/contents/detail/form/balance-correction/schema/schema.ts) (field `countAsCash`, default `true`), [field-count-as-cash.tsx](../../../src/features/accounts/contents/detail/form/balance-correction/components/fields/field-count-as-cash.tsx), [use-correct-account-balance.ts](../../../src/features/accounts/contents/detail/form/balance-correction/hooks/use-correct-account-balance.ts) (`resolveIsCashNeutral`). Polaritas UI SENGAJA sama arah dgn field (`countAsCash`, bukan `isCashNeutral`) supaya tidak ada double-negative antara label dan kolom DB — baru di-invert ke `is_cash_neutral` saat insert.
- [x] Update semua query ringkasan (desktop) (2026-10-19) — 9 lokasi di "Cakupan yang perlu diperbaiki" (desktop) ditambah `AND is_cash_neutral = 0` (atau `t.is_cash_neutral = 0` utk query beralias). Verifikasi: `tsc --noEmit` bersih, 265 test lolos, DAN simulasi langsung ke copy `finance.dev.db` — insert 1 baris `is_cash_neutral=1` nominal Rp 999.999, jalankan query ringkasan versi lama vs baru, selisihnya PERSIS Rp 999.999 (filter benar-benar aktif, bukan cuma syntax valid tanpa efek). Baris simulasi dihapus lagi setelahnya.
- [x] Update semua query ringkasan (worker/MCP) (2026-10-19) — 3 tool MCP (`get_cashflow_breakdown`, `get_expense_summary_by_category`, `get_category_period_summary`) ditambah filter exclude `isCashNeutral`, lihat detail di poin 8 "Pekerjaan yang MASIH KOSONG" di bawah.
- [x] Keputusan & implementasi sync kolom ke `apps/worker` D1 (2026-10-19) — DIPUTUSKAN ikut disinkronkan per baris (BUKAN dihitung ulang terpisah di server), konsisten dgn kolom lain (`source`/`source_ref`). Lihat checklist detail di bawah.
- [x] Verifikasi end-to-end lewat UI nyata (2026-10-19) — write-off debt, pelunasan non-cash, write-off investasi, DAN toggle Koreksi Saldo kas, semua dijalankan di `tauri dev` sungguhan lalu dicek ke copy DB dev. SELURUH dokumen ini (migrasi -> titik insert -> form toggle -> filter query -> sync worker/D1 -> MCP) SELESAI diimplementasikan & diverifikasi.

## Latar belakang

Dipicu oleh investigasi nyata (2026-10-16): ditemukan selisih Rp 83.100 antara angka "Pengeluaran" di kartu Kalender desktop vs hasil MCP `get_cashflow_breakdown`. Setelah ditelusuri, sumbernya adalah baris transaksi `type='expense'` berjudul "Penutup piutang/utang dihapuskan" yang dibuat otomatis oleh `useWriteOffDebt()` (lihat [use-write-off-debt.ts](../../../src/shared/debts/use-write-off-debt.ts)) saat sebuah piutang/utang ditandai `written_off` — baris sisa dari bug settlement lama, sudah dibersihkan manual dari DB (lihat riwayat chat, bukan di dokumen ini).

Investigasi lanjutan mengungkap masalah yang LEBIH MENDASAR dan lebih luas dari sekadar satu baris sampah: TIDAK ADA satupun query ringkasan di aplikasi ini (Kalender, Dashboard, Laporan, MCP) yang membedakan transaksi kas riil dari transaksi non-kas — semuanya cuma filter `type IN ('income','expense')` + tanggal, tanpa peduli apakah uang benar-benar berpindah secara fisik.

### Kasus uji nyata yang dipakai menguji ini (DB dev, 2026-10-16)

Tiga transaksi dibuat berurutan untuk kontak uji coba (akun "Utang Dagang", tipe `debt`):

1. **"Misal Beli Barang"** — `type='expense'`, Rp 100.000, lewat form transaksi BIASA (bukan dialog debt khusus) dengan akun bertipe `debt` + kontak terisi. Otomatis membuat baris `debts` (payable, ongoing). IKUT terhitung "Pengeluaran" (benar secara MAKNA single-entry: ini "beban" sungguhan yang user sengaja catat, meski belum ada kas keluar).
2. **"Cicilan Pertama"** — `type='transfer'` dari akun debt ke akun kas, Rp 50.000, lewat form "Bayar" piutang/utang. TIDAK ikut terhitung (karena `type='transfer'`, bukan `income`/`expense`) — padahal ini justru kas RIIL yang keluar.
3. **"Pemutihan"** — `type='income'`, Rp 50.000, akun debt yang sama, dibuat manual meniru pola `useWriteOffDebt()`. IKUT menaikkan "Pendapatan", padahal tidak ada uang masuk sama sekali — ini pembebasan kewajiban (gain akuntansi), bukan kas masuk.

Kesimpulan dari kasus ini: TIDAK ada double-counting (transaksi #1 dan #3 tidak saling meniadakan di angka cashflow), tapi arah errornya dua-duanya condong SALAH untuk tujuan "cashflow kas riil": #1 dan #3 (bukan kas riil) ikut masuk, sementara #2 (kas riil beneran) tidak pernah tercatat di laporan manapun.

### Audit cakupan (2026-10-16, lihat detail di "Cakupan yang perlu diperbaiki")

Hampir semua lokasi ringkasan income/expense di app ini punya pola yang sama — TIDAK exclude transaksi non-kas:

- Kalender (Transaksi): `use-month-summary.ts`, `use-transaction-days.ts`
- Dashboard: ringkasan bulan ini, tren 6 bulan, Total Saldo
- Laporan: tab Cashflow (summary, breakdown, drill-down), tab Periode Kategori
- MCP: `get_cashflow_breakdown`, `get_expense_summary_by_category`, `get_category_period_summary`

Satu-satunya fitur yang SUDAH punya mekanisme filter tipe akun adalah "Tren Saldo" (`use-balance-trend.ts`, desktop & mcp-server) — tapi filternya OPSIONAL dengan default "semua tipe ikut", jadi secara default perilakunya sama saja dengan yang lain.

## Kenapa BUKAN berdasarkan `account_type`

Godaan pertama: filter laporan `WHERE account_type = 'cash'` di level akun (mirip rencana [[project_investment_account_type_concept]] untuk `third_party`, lihat `account-type-third-party.md` poin "Pengecualian cashflow"). INI SALAH untuk kasus `debt`/`investment` (beda dari `third_party`) — didiskusikan & ditolak eksplisit (2026-10-16):

- Akun bertipe `debt`/`investment` MEMANG BISA dan BOLEH mempengaruhi income/expense dalam pemakaian normal — kasus #1 ("Misal Beli Barang") di atas itu transaksi yang SAH dan SENGAJA: user mencatat utang baru lewat form biasa, dan itu MEMANG seharusnya dianggap "beban" di laporan (meski belum ada kas keluar) — bukan kasus yang mau di-exclude.
- Yang perlu di-exclude cuma transaksi PENUTUP OTOMATIS tertentu yang SISTEM sendiri yang buat (write-off, koreksi saldo, dst) — bukan semua transaksi yang kebetulan lewat akun non-cash.
- `third_party` BEDA KASUS — menurut `account-type-third-party.md`, akun ini MEMANG didesain supaya TIDAK PERNAH mempengaruhi income/expense sejak awal (bukan kasus per-transaksi). Jadi exclude berdasarkan `account_type = 'third_party'` tetap valid dan terpisah dari masalah yang dibahas di dokumen ini — JANGAN disatukan logicnya.

Kesimpulan: exclude harus di level TRANSAKSI (flag eksplisit per baris), bukan di level akun.

## Rancangan

Kolom baru di tabel `transactions`: `is_cash_neutral INTEGER NOT NULL DEFAULT 0` (diputuskan 2026-10-16).

Pertimbangan tipe (boolean vs enum/reason): dipilih boolean sederhana, BUKAN kolom `TEXT` berisi alasan (mis. `'debt_write_off'`, `'investment_write_off'`). Boolean cukup untuk kebutuhan filter laporan sekarang, konsisten dengan pola `is_active` yang sudah dipakai di `accounts`/`categories`. Kalau nanti ada kebutuhan nyata untuk tahu ALASAN sebuah transaksi ditandai non-kas (mis. badge "Transaksi Penutup" di detail transaksi, atau audit/debugging), itu diputuskan terpisah saat kebutuhannya muncul — jangan diasumsikan sekarang.

Pertimbangan nama (`is_cash_neutral` vs `excluded_from_cashflow` vs `is_closing_entry`): dipilih `is_cash_neutral` — "netral terhadap kas", menekankan bahwa transaksi ini tetap mempengaruhi saldo akun non-cash (debt/investment) secara sah, hanya saja tidak dihitung sebagai pergerakan kas riil di laporan cashflow.

Default `0`/`false` untuk SEMUA transaksi yang user input manual lewat form biasa (termasuk lewat akun `debt`/`investment`, seperti kasus #1). Di-set `1`/`true` HANYA oleh titik-titik insert yang merupakan transaksi penutup otomatis sistem sendiri (lihat daftar di bawah).

Semua query ringkasan lalu ditambah `AND is_cash_neutral = 0` sebagai filter tambahan, di SEMUA lokasi yang disebut di "Cakupan yang perlu diperbaiki" — baik desktop maupun worker/MCP.

### Titik insert transaksi penutup (kandidat yang WAJIB set `is_cash_neutral = 1`)

Audit lengkap selesai (2026-10-16) — jalur normal form transaksi adalah `insertTransactionToDb` ([insert-to-db.ts](../../../src/features/transactions/form/add-edit/hooks/helper/insert-to-db.ts)), dipanggil dari `create-transaction/{cash,debt,investment}/*` dan `update-to-db.ts`. Semua insert LAIN di luar fungsi ini sudah diperiksa satu per satu:

**Dipastikan perlu `is_cash_neutral = 1`:**

- [use-write-off-debt.ts:43](../../../src/shared/debts/use-write-off-debt.ts) — "Penutup piutang/utang dihapuskan", transaksi `expense`/`income` langsung pada akun debt. KASUS ASLI yang memicu investigasi ini.
- [apply-write-off-investment-transaction.ts:90](../../../src/shared/investments/apply-write-off-investment-transaction.ts) — write-off investasi, transaksi `expense` penutup senilai modal rata-rata, `transfer_account_id` NULL (tidak ada leg ke kas sama sekali).
- `use-pay-debt.ts:117`, bagian `settlement_mode === 'non_cash'` DENGAN `debt.account_id` terisi (lihat [use-pay-debt.ts:108-128](../../../src/shared/debts/pay-debt-form/use-pay-debt.ts#L108-L128)) — transaksi penutup langsung pada akun debt, dikonfirmasi oleh komentar di file itu sendiri ("TIDAK ada uang riil berpindah ke akun kas mana pun").
- Koreksi saldo (`use-correct-account-balance.ts`) untuk akun bertipe **Utang/Piutang** dan **Investasi** — lihat "Koreksi saldo — keputusan per tipe akun" di bawah untuk detail lengkap & akun Kas yang beda perlakuan.

**Dipastikan TIDAK perlu flag (kas riil sah, default `0`):**

- `use-pay-debt.ts:154`, bagian `debt.account_id == null` (data sync Retailku) — `type='income'`/`expense'` tapi uang kas riil benar-benar masuk/keluar akun kas sungguhan.
- `use-pay-debt.ts:181`, pelunasan cash normal — `type='transfer'`, sudah otomatis tidak masuk hitungan `income`/`expense` dari awal, tidak perlu flag tambahan.
- `apply-sell-investment-transaction.ts:246` (leg Realized P/L) dan `:309` (leg settlement) — representasi kas riil yang sah dari penjualan investasi.
- Shortcut "Tambah Utang/Piutang Baru" ([new-debt-form/use-create-debt.ts:58](../../../src/shared/debts/new-debt-form/use-create-debt.ts)) dan "Tambah/Jual Investasi" (`new-purchase-form/use-create-investment-purchase.ts:61`, `sell-investment-form/use-create-investment-sale.ts:75`) — transfer kas↔debt/investment biasa, identik perilakunya dengan form transaksi biasa.
- `pull-sync/upsert-transaction.ts:9` (sinkronisasi cloud) dan Retailku `insert-cashflow-transaction.ts:18` — data yang sudah pernah dibuat via jalur sah lain / kas riil toko, akan ikut membawa nilai `is_cash_neutral` dari sumbernya setelah kolom disinkronkan.

Tidak ditemukan titik lain di luar daftar ini (grep sistematis `INSERT INTO transactions` di seluruh `apps/desktop/src` sudah dilakukan).

### Koreksi saldo — keputusan per tipe akun (2026-10-16)

[use-correct-account-balance.ts:52-56](../../../src/features/accounts/contents/detail/form/balance-correction/hooks/use-correct-account-balance.ts#L52-L56) saat ini generik total — tidak ada percabangan `account_type` sama sekali, insert `income`/`expense` yang sama untuk akun apa pun yang dikoreksi. Ini sudah dikonfirmasi sebagai gap nyata (bukan cuma dugaan), dan perlakuannya TERNYATA beda-beda per tipe akun, bukan satu aturan tunggal:

- **Utang/Piutang** — otomatis `is_cash_neutral = 1`, TANPA tanya user. Alasan: `docs/concept/konsep-tipe-akun.md` baris 62-70 sudah menyebut eksplisit bahwa koreksi saldo akun jenis ini TIDAK menyentuh baris `debts` turunan sama sekali — sama persis strukturnya dengan write-off, tidak ambigu.
- **Investasi** — sama seperti Utang/Piutang: otomatis `is_cash_neutral = 1` tanpa tanya. Koreksi saldo tidak menyentuh `investment_purchases`/`investment_sales`, strukturnya jelas bukan kas riil.
- **Kas** — AMBIGU secara konsep (bisa beralasan dua arah: koreksi karena "nemu selisih kas fisik riil" vs "cuma benerin salah catat administratif"), jadi TIDAK diputuskan sepihak oleh sistem. User diberi pilihan eksplisit di form "Koreksi Saldo" (checkbox/toggle, mis. "Hitung sebagai transaksi kas di laporan?") — user yang paling tahu konteks koreksinya saat itu.
- **Dana Pihak Ketiga** — TIDAK relevan untuk flag `is_cash_neutral` ini. Sesuai `account-type-third-party.md` poin "Pengecualian cashflow", tipe ini memang dikecualikan dari cashflow lewat jalur `account_type` sendiri (bukan per-transaksi) — jangan tambahkan logic `is_cash_neutral` untuk kasus ini, biarkan ditangani terpisah oleh rencana `third_party` yang sudah ada.

Implikasi implementasi: form "Koreksi Saldo" ([balance-correction/components/index.tsx](../../../src/features/accounts/contents/detail/form/balance-correction/components/index.tsx)) perlu field baru (checkbox/toggle) yang HANYA muncul saat akun yang dikoreksi bertipe `cash` — untuk `debt`/`investment` langsung di-set `true` di belakang layar tanpa UI tambahan, untuk `third_party` tidak relevan sama sekali.

**Catatan penting, JANGAN tercampur dengan topik ini**: Koreksi Saldo pada akun `debt`/`investment` punya masalah LAIN yang sama sekali berbeda akarnya — data turunannya (`debts`, `investment_purchases`) tidak ikut disesuaikan saat saldo dikoreksi, membuat saldo akun dan data turunan jadi timpang. Ini BUKAN sesuatu yang `is_cash_neutral` perbaiki atau perparah (flag ini cuma soal tampil-tidaknya di laporan, tidak menyentuh `accounts.balance`). Gap ini sudah ada sebelum rencana ini dan butuh solusi desain terpisah — lihat dokumen [balance-correction-derived-data-consistency.md](balance-correction-derived-data-consistency.md).

**Dependency SEBALIKNYA (penting, koreksi dari diskusi 2026-10-16)**: meski akar masalahnya beda, dokumen itu TIDAK bisa dianggap independen murni dari dokumen INI — toggle "Hitung sebagai transaksi kas di laporan?" untuk akun Kas (poin di atas) menyimpan nilainya ke kolom `is_cash_neutral`, yang BARU ADA setelah migrasi di dokumen INI selesai. Jadi urutan kerja wajib: migrasi kolom `is_cash_neutral` (langkah 3 di "Pekerjaan yang MASIH KOSONG" bawah) HARUS selesai dulu, baru toggle itu bisa diimplementasikan nyata di `balance-correction-derived-data-consistency.md`. Bagian LAIN dari dokumen itu (audit third_party, desain solusi debt/investment) tetap independen dari dependency ini.

### Cakupan yang perlu diperbaiki (semua lokasi, hasil audit 2026-10-16)

**Desktop:**

- `apps/desktop/src/features/transactions/shared/hooks/use-month-summary.ts`
- `apps/desktop/src/features/transactions/shared/hooks/use-transaction-days.ts`
- `apps/desktop/src/features/dashboard/content/current-month-summary/use-current-month-summary.ts`
- `apps/desktop/src/features/reports/use-monthly-summary.ts` (dipakai mini trend chart dashboard)
- `apps/desktop/src/features/reports/content/cashflow/use-cashflow-summary.ts`
- `apps/desktop/src/features/reports/content/cashflow/use-cashflow-breakdown.ts` (3 varian: account_group, parent_category, label)
- `apps/desktop/src/features/reports/content/cashflow/use-cashflow-transactions.ts`
- `apps/desktop/src/features/reports/content/category-period-summary/use-category-period-summary.ts`
- `apps/desktop/src/features/reports/content/category-period-summary/use-category-period-transactions.ts`

**Worker/MCP** (`apps/mcp-server/src/lib/sync-snapshot/entities/`):

- `transactions/summarize-cashflow.ts` (tool `get_cashflow_breakdown`)
- `categories/summarize-expense-by-category.ts` (tool `get_expense_summary_by_category`)
- `category-periods/get-category-period-summary.ts` (tool `get_category_period_summary`)

**Tidak termasuk cakupan ini** (by design, kasus berbeda):

- `use-balance-trend.ts` (desktop & mcp-server) — sudah punya filter `accountTypes` opsional, bukan masalah yang sama.
- `use-account-balances.ts`, `use-balances-by-account-type.ts` — breakdown per akun/tipe, bukan agregat income/expense.
- Pengecualian `third_party` dari cashflow — item TERPISAH, lihat `account-type-third-party.md` poin "Pengecualian cashflow", JANGAN digabung implementasinya dengan flag `is_cash_neutral` ini (beda akar masalah, lihat "Kenapa BUKAN berdasarkan `account_type`" di atas).

## Pekerjaan yang MASIH KOSONG

1. ~~Putuskan nama & tipe kolom final~~ — SELESAI (2026-10-16), `is_cash_neutral INTEGER NOT NULL DEFAULT 0`.
2. ~~Audit sistematis SEMUA titik `INSERT INTO transactions` di luar jalur form normal~~ — SELESAI (2026-10-16), lihat "Titik insert transaksi penutup" & "Koreksi saldo — keputusan per tipe akun".
3. ~~Tulis migrasi SQLite, verifikasi lewat copy DB dev, daftarkan di `migrations.rs`~~ — SELESAI (2026-10-19), lihat checklist di atas. Catatan: `docs/rules/checking-dev-database.md` yang direferensikan sebelumnya BELUM ADA sebagai file (belum pernah dibuat) — verifikasi dilakukan manual: copy `finance.dev.db` ke scratchpad lalu `ALTER TABLE` + `PRAGMA integrity_check`/`foreign_key_check` lewat sqlite3 CLI langsung terhadap copy itu, bukan file asli.
4. ~~Update titik insert transaksi penutup (write-off debt, write-off investasi, pelunasan non-cash dengan `debt.account_id` terisi) supaya set `is_cash_neutral = 1`~~ — SELESAI (2026-10-19), lihat checklist di atas. Verifikasi: unit test terkait (47 test, 5 file di `src/shared/debts` + `apply-write-off-investment-transaction.test.ts`) lolos, `tsc --noEmit` bersih.
5. ~~Tambah field toggle di form "Koreksi Saldo"~~ — SELESAI (2026-10-19), lihat checklist di atas. Verifikasi: `tsc --noEmit` bersih, 265 test (seluruh suite desktop) lolos, alur data ditelusuri manual end-to-end (dialog -> form -> hook -> SQL). Boot GUI Tauri penuh TIDAK dicoba (tidak ada skill project utk ini, risiko setup xvfb/native build > manfaat utk perubahan sekecil ini) — kalau user mau coba manual: buka dialog Koreksi Saldo di 3 akun beda tipe (cash/debt/investment), pastikan checkbox cuma muncul di akun cash.
6. ~~Update semua query di "Cakupan yang perlu diperbaiki" (desktop) tambah filter `AND is_cash_neutral = 0`~~ — SELESAI (2026-10-19), lihat checklist di atas.
7. ~~Putuskan & implementasikan sinkronisasi kolom baru ini ke `apps/worker` (D1)~~ — SELESAI (2026-10-19). Diputuskan: sync per baris (bukan hitung ulang terpisah). Rantai lengkap yg disentuh (3 definisi tipe transaction TERPISAH -- desktop/worker/mcp-server, TIDAK ada shared package, dipetakan via Explore agent dulu sebelum eksekusi):
   - **D1 schema**: [0008_transaction_cash_neutral_flag.sql](../../../../worker/schema/0008_transaction_cash_neutral_flag.sql) — `ALTER TABLE transactions ADD COLUMN is_cash_neutral INTEGER NOT NULL DEFAULT 0`. Diterapkan ke `--local` DULU (verifikasi `PRAGMA table_info`), BARU `--remote` (production nyata) setelah dikonfirmasi user secara eksplisit (ini database shared, 1 Worker dipakai dev+prod sesuai [[project_worker_dev_prod_isolation]]). Hasil `--remote`: kolom ada sesuai spek, 5774/5774 baris existing otomatis `is_cash_neutral=0`, `changed_db: true` tanpa error.
   - **Worker schema.ts** ([transactions/schema.ts](../../../../worker/src/modules/transactions/schema.ts)): field `isCashNeutral?: boolean` opsional di `PushTransactionPayload` + validator di `isPushTransactionPayload`/`isPatchTransactionPayload`.
   - **Worker service.ts** ([transactions/service.ts](../../../../worker/src/modules/transactions/service.ts)): INSERT set dari payload (default 0 kalau tidak dikirim); UPDATE pakai pola SAMA dgn `source`/`source_ref` (`CASE WHEN ?n=1 THEN ... ELSE kolom_lama END`) — PATCH yang tidak mengirim field ini TIDAK menghapus flag yang sudah di-set, supaya client lama/MCP yang belum tahu field ini aman.
   - **Worker sync entity** ([sync/service/entities/transactions.ts](../../../../worker/src/modules/sync/service/entities/transactions.ts)): SELECT + mapping camelCase ditambah `isCashNeutral`. `sync/service/index.ts` TIDAK perlu diubah (langsung passthrough array, tanpa mapping manual).
   - **Desktop push** ([push-transaction-row.ts](../../../src/shared/cloud-sync/push-row/push-transaction-row.ts), [push-transaction.ts](../../../src/shared/cloud-sync/worker-client/push-transaction.ts)): SELECT lokal + payload ditambah `is_cash_neutral`/`isCashNeutral`.
   - **Desktop pull** ([upsert-transaction.ts](../../../src/shared/cloud-sync/pull-sync/upsert-transaction.ts), [pull-sync.ts](../../../src/shared/cloud-sync/worker-client/pull-sync.ts)): INSERT...ON CONFLICT ditambah kolom, `SyncResponse` type ditambah field.
   - Verifikasi: `tsc --noEmit` bersih di desktop/worker/mcp-server, 265 test desktop lolos (1 fixture test disesuaikan — `isCashNeutral: false` ditambah ke `pull-sync.test.ts`). Worker & mcp-server belum punya unit test sama sekali (bukan regresi dari perubahan ini).
8. ~~Update semua tool MCP yang disebut di atas~~ — SELESAI (2026-10-19). [types.ts](../../../../mcp-server/src/lib/sync-snapshot/types.ts) (`Transaction.isCashNeutral`), lalu filter `if (t.isCashNeutral) continue;` (atau `!t.isCashNeutral` di filter array) ditambah di [summarize-cashflow.ts](../../../../mcp-server/src/lib/sync-snapshot/entities/transactions/summarize-cashflow.ts) (`get_cashflow_breakdown`), [summarize-expense-by-category.ts](../../../../mcp-server/src/lib/sync-snapshot/entities/categories/summarize-expense-by-category.ts) (`get_expense_summary_by_category`), [get-category-period-summary.ts](../../../../mcp-server/src/lib/sync-snapshot/entities/category-periods/get-category-period-summary.ts) (`get_category_period_summary`, filter diterapkan ke array `transactions` yg dikembalikan, bukan cuma ke total).
9. ~~Verifikasi ulang end-to-end~~ — SELESAI (2026-10-19). User menjalankan 3 skenario nyata lewat UI `tauri dev`: (a) write-off debt pada akun "Piutang" (2 baris "Pemutihan", expense+income Rp 10.000), (b) pelunasan non-cash debt "SPayLater" (income Rp 1.000.000, akun "Test Utang Baru"), (c) write-off investasi "Akun Investasi" (expense Rp 10.909,09, 1 unit). Diverifikasi ke copy `finance.dev.db`+`-wal`+`-shm`: SEMUA 4 transaksi baru (termasuk toggle Koreksi Saldo dari sesi sebelumnya) otomatis `is_cash_neutral=1`, TIDAK ada yg lolos jadi `0`. Query current-month-summary dgn filter vs tanpa filter: selisih expense & income masing-masing PERSIS sama dgn total nominal transaksi testing per type (expense 20909.0909091, income 1010000) — filter laporan terbukti exclude SEMUA kombinasi baru ini. `integrity_check`/`foreign_key_check` bersih. Koreksi saldo kas (toggle) sudah diverifikasi terpisah di sesi sebelumnya (lihat catatan test manual di atas).

**Catatan baseline dev DB (2026-10-19)**: migrasi 52 sudah ter-apply ke instance `tauri dev` yang berjalan (dicek `_sqlx_migrations`), kolom `is_cash_neutral` ada & `integrity_check` bersih, 5620/5620 baris existing `is_cash_neutral=0`. Ditemukan 5 baris "Koreksi saldo" LAMA (dibuat sebelum toggle form ada, 2025-03-01 & 2026-09-28) pada akun bertipe `debt` yang masih `is_cash_neutral=0` — menurut desain seharusnya `1`. BUKAN bug kode baru (kode baru sudah benar utk transaksi BARU), murni gap data historis. Keputusan user: TIDAK di-backfill (nominal tidak material) — dicatat di sini saja, jangan dikerjakan tanpa diminta ulang.

**Test manual end-to-end lewat UI `tauri dev` sungguhan (2026-10-19)**: user membuat 2 transaksi Koreksi Saldo di akun cash "Gopay" lewat dialog nyata — 1 dengan toggle "Hitung sebagai transaksi kas?" DICENTANG, 1 TIDAK. Diverifikasi ke copy `finance.dev.db`+`-wal`+`-shm` (prosedur `checking-dev-database.md`): baris expense Rp 10.000 (toggle OFF) tersimpan `is_cash_neutral=1`, baris income Rp 10.000 (toggle ON) tersimpan `is_cash_neutral=0` — SESUAI ekspektasi. Query `use-current-month-summary.ts` (dengan filter baru) vs versi tanpa filter: selisih expense PERSIS Rp 10.000, income tidak berubah. Rantai penuh UI->form->hook->SQL->kolom DB->query laporan TERBUKTI bekerja di app nyata, bukan cuma lolos tsc/test.
