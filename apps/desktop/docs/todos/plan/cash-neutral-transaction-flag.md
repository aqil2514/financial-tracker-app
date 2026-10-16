# Penanda Transaksi Non-Kas (Cash-Neutral) di Laporan

## Status & TODO saat ini (ringkas)

Penjelasan lengkap tiap poin ada di bagian "Latar belakang" dan "Rancangan" di bawah — BACA DULU sebelum menulis kode apa pun di sini, terutama bagian "Kenapa BUKAN berdasarkan `account_type`" karena ini kesalahpahaman yang sempat muncul di diskusi awal.

- [x] Gap ditemukan & cakupannya diaudit (2026-10-16) — hampir semua laporan (Kalender, Dashboard, Laporan, MCP) tidak membedakan transaksi kas riil vs non-kas.
- [x] Definisi "non-kas" diputuskan (2026-10-16) — per TRANSAKSI, bukan per tipe akun, lihat "Kenapa BUKAN berdasarkan `account_type`".
- [x] Desain skema kolom baru diputuskan (2026-10-16) — `is_cash_neutral INTEGER NOT NULL DEFAULT 0`, boolean sederhana (bukan enum/reason), lihat "Rancangan" untuk alasan pemilihan nama & tipe.
- [x] Audit lengkap titik insert di luar jalur form normal selesai (2026-10-16) — lihat "Titik insert transaksi penutup", semua kandidat terverifikasi terhadap kode saat ini.
- [x] Keputusan koreksi saldo (`use-correct-account-balance.ts`) diambil (2026-10-16) — akun Utang/Piutang & Investasi otomatis `is_cash_neutral=1` tanpa tanya, akun Kas user pilih sendiri lewat opsi di form (lihat "Koreksi saldo — keputusan per tipe akun").
- [ ] Migrasi SQLite ditulis & diverifikasi — belum (`ALTER TABLE transactions ADD COLUMN is_cash_neutral INTEGER NOT NULL DEFAULT 0`).
- [ ] Registrasi migrasi baru di `migrations.rs` — belum (lihat [[feedback_migration_rs_registration]] kalau pakai agen di sesi lain).
- [ ] Update semua query ringkasan (desktop) — belum, daftar lokasi di bawah ("Cakupan yang perlu diperbaiki").
- [ ] Update semua query ringkasan (worker/MCP) — belum.
- [ ] Keputusan: kolom ini ditambah ke `apps/worker` D1 juga (sync), atau dihitung ulang terpisah di server — belum dibahas.

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
3. Tulis migrasi SQLite (`ALTER TABLE transactions ADD COLUMN is_cash_neutral INTEGER NOT NULL DEFAULT 0`), verifikasi lewat copy DB dev (lihat [docs/rules/checking-dev-database.md](../../../docs/rules/checking-dev-database.md)), daftarkan di `migrations.rs`.
4. Update titik insert transaksi penutup (write-off debt, write-off investasi, pelunasan non-cash dengan `debt.account_id` terisi) supaya set `is_cash_neutral = 1`.
5. Tambah field toggle di form "Koreksi Saldo" ([balance-correction/components/index.tsx](../../../src/features/accounts/contents/detail/form/balance-correction/components/index.tsx)) — muncul HANYA untuk akun bertipe `cash` (user pilih), otomatis `true` tanpa UI untuk `debt`/`investment`, tidak relevan untuk `third_party`. Update [use-correct-account-balance.ts](../../../src/features/accounts/contents/detail/form/balance-correction/hooks/use-correct-account-balance.ts) supaya terima & simpan nilai ini.
6. Update semua query di "Cakupan yang perlu diperbaiki" (desktop) tambah filter `AND is_cash_neutral = 0`.
7. Putuskan & implementasikan sinkronisasi kolom baru ini ke `apps/worker` (D1) — apakah ikut di-sync per baris, atau MCP server menghitung ulang logic yang sama secara independen.
8. Update semua tool MCP yang disebut di atas.
9. Verifikasi ulang end-to-end: ulangi kasus uji 3 transaksi di atas, pastikan angka Kalender desktop & MCP kembali cocok, dan semua kombinasi (debt baru, cicilan, pemutihan, write-off investasi, koreksi saldo kas/debt/investment) menghasilkan angka yang masuk akal secara kas riil.
