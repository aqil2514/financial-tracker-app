# Satukan jalur direct/write-off ke form transaksi utama

## Status & TODO saat ini (ringkas)

Penjelasan tiap poin ada di bagian "Detail & rasional keputusan" paling bawah — lihat juga [docs/concept/konsep-transaksi.md](../../../../../docs/concept/konsep-transaksi.md), [docs/concept/konsep-utang-piutang.md](../../../../../docs/concept/konsep-utang-piutang.md), dan [docs/concept/konsep-investasi.md](../../../../../docs/concept/konsep-investasi.md) bagian "Unit yang berubah TANPA transfer kas" — BACA DULU sebelum menulis kode apa pun di sini. Dokumen ini BARU catatan rencana, BELUM ada satu baris kode pun untuk penyatuan ini. Kita masih di form transaksi utama (`features/transactions/form`) — belum menyentuh dialog/halaman lain.

### Jalur Create

- [x] Kasus Normal — lihat catatan di bawah.
- [ ] Kasus Utang Piutang — belum ada, income/expense langsung ke akun `debt`.
- [ ] Kasus Investasi — belum ada, income/expense langsung ke akun `investment`.

### Jalur Update

- [ ] Kasus Normal — belum direview ulang untuk pola baru ini.
- [ ] Kasus Utang Piutang — belum ada, edit income/expense yang sudah direct ke akun `debt`.
- [ ] Kasus Investasi — belum ada, edit income/expense yang sudah direct ke akun `investment` (sudah ada fix bug 2026-10-08 di jalur lama, jangan diregresi).
- [ ] **Bug ditemukan 2026-10-14, BELUM diperbaiki** — edit transfer ganti
      pasangan akun lintas domain (investment↔debt) menyisakan baris
      turunan lama jadi yatim. Detail: [docs/dogfooding/2026-10-14-transfer-ganti-pasangan-akun-silang-investment-debt-sisakan-baris-yatim.md](../../../../../docs/dogfooding/2026-10-14-transfer-ganti-pasangan-akun-silang-investment-debt-sisakan-baris-yatim.md).
- [x] **BaseForm Update kini TERUJI runtime (2026-10-14)** — dialog Edit
      (BaseForm) dibuat + diverifikasi: kontrak `isLoading` jalan, field
      debt yang sudah dicicil terkunci di UI, edit field aman tidak
      merusak `debt_payments`, transfer cash→debt dan cash→investment via
      edit benar (lihat catatan di bawah). Debt→cash (settlement FIFO) dan
      transfer cash↔cash via Update BELUM dicoba.

### Jalur Delete

- [ ] Kasus Normal — belum direview ulang untuk pola baru ini.
- [ ] Kasus Utang Piutang — belum ada, hapus income/expense direct ke akun `debt`.
- [ ] Kasus Investasi — belum ada, hapus income/expense direct ke akun `investment`.

### Form

- [ ] Field tambahan utk akun `debt` (kontak, arah piutang/utang) saat `income`/`expense` — belum ada.
- [ ] Field tambahan utk akun `investment` (unit, harga per unit) saat `income`/`expense` — belum ada, saat ini exclusive `transfer`.
- [ ] Keputusan `record_mode` eksplisit vs deteksi otomatis dari tipe akun — belum diputuskan.

### Nasib dialog/form lama

- [ ] `new-debt-form` (`record_mode: 'direct'`) — CONDONG dihapus setelah form utama solid, belum final.
- [ ] `new-purchase-form` (`record_mode: 'direct'`) — CONDONG dihapus setelah form utama solid, belum final.
- [ ] `write-off-investment-form` — CONDONG dihapus setelah form utama solid, belum final.
- [ ] Tools MCP (`create_debt_direct`, `create_investment_purchase_direct`, `write_off_investment`) — TIDAK otomatis ikut terhapus, cek dulu.

### Refactor

- [ ] `applyDebtTransaction` — saat ini `return none` kalau `type !== 'transfer'`, perlu dibuka untuk income/expense direct & write-off.
- [ ] `applyInvestmentTransaction` — saat ini `return none` kalau `type !== 'transfer'`, perlu dibuka untuk income/expense direct & write-off.
- [x] Form transaksi utama pindah ke `BaseForm` generik — SELESAI untuk sisi Create DAN Update, keduanya sudah teruji runtime (lihat catatan di bawah). **"Naik pangkat" SELESAI (2026-10-14)**: `TransactionCreateDialog`/`TransactionEditDialog` sekarang langsung memakai `BaseForm`, dialog uji coba terpisah dan folder `base-form-migration/` sudah tidak ada lagi — isinya dipindah jadi struktur permanen `form/add-edit/{components,context,hooks,schema}/`. Form lama (`useEntityForm`, `TransactionBaseForm` wrapper) dihapus total.

## Kenapa ini dianggap gap, bukan desain final

Form transaksi utama (`createTransaction`/`use-create-transaction`) "secara arsitektur SELALU insert satu baris `transactions` begitu disubmit" (lihat `konsep-investasi.md` bagian soal "Dana BARU cair saat settled") — alasan historis kenapa jalur direct/write-off dipisah ke dialog lain adalah form utama BELUM dirancang untuk bercabang per jenis akun untuk `income`/`expense` (cuma `transfer` yang sudah bercabang, lewat `classifyAccountPair`). Setelah refactor `use-create-transaction` 2026-10-13/14 (lihat [handover 2026-10-13](../../../../../docs/handover-session/2026-10/2026-10-13-1-migrasi-page-layout-accounts-investments-third-party-mulai-transactions.md) dan commit setelahnya), struktur per-tipe (`income.ts`/`expense.ts`/`transfer/{cash,debt,investment}.ts`) sudah ada — jadi menambah percabangan jenis akun DI DALAM `income.ts`/`expense.ts` (mirip pola yang sudah dipakai `transfer/`) sekarang jadi masuk akal secara struktural, bukan cuma ide di awang-awang.

**Preseden pola yang SUDAH terbukti jalan** (jangan didesain ulang dari nol): `third_party` (lihat [account-type-third-party.md](account-type-third-party.md) tabel "Perbandingan dengan pola yang sudah ada") SUDAH direncanakan sejak awal dengan pola "trigger utama `income`/`expense` SATU SISI, bukan transfer" — artinya kalau domain `debt`/`investment` berhasil disatukan ke form utama lewat dokumen ini, `third_party` kemungkinan BISA mengikuti pola yang sama sejak awal (belum perlu direct/write-off terpisah sama sekali, karena fiturnya belum pernah dibangun di dialog lain).

## Pekerjaan yang MASIH KOSONG

Urutan kerja — domain mana duluan (Utang-Piutang vs Investasi) BELUM diputuskan final, pertimbangan yang didiskusikan:

- **Utang-Piutang duluan**: lebih sederhana (tidak ada unit/average cost/pending-settled), risiko regresi lebih kecil untuk jadi domain percobaan pola baru ini.
- **Investasi duluan**: lebih kompleks, tapi domain ini SUDAH pernah mengalami bug nyata dari gap yang sama (2026-10-08) — mengerjakannya duluan berarti pola yang dihasilkan sudah teruji lawan kasus paling rumit, domain lain tinggal ikut pola itu.

Setelah Create/Update/Delete/Form solid untuk kedua domain (checklist selesai, teruji manual via `docs/rules/checking-dev-database.md`): baru pertimbangkan penghapusan dialog/form lama, baru (kalau relevan) terapkan pola yang sama ke `third_party` yang masih dalam pengembangan aktif (lihat [account-type-third-party.md](account-type-third-party.md)).

## Detail & rasional keputusan

**Kenapa dicatat sebagai dokumen terpisah, bukan ditambahkan ke `account-type-investment.md`/dokumen debt yang sudah ada** — ini perubahan LINTAS domain (debt DAN investment, berpotensi third_party juga), bukan spesifik satu tipe akun — menyatukan prinsip arsitektur form transaksi utama, bukan menambah fitur baru ke satu tipe akun.

**Kenapa belum ada kode sama sekali** — keputusan domain mana duluan sengaja ditunda sampai didiskusikan lebih lanjut (instruksi eksplisit "catat dulu di todos/plan", 2026-10-14) — konsisten dengan disiplin "diskusikan dulu sebelum implementasi" di [konsep-tipe-akun.md](../../../../../docs/concept/konsep-tipe-akun.md) bagian penutup, karena perubahan ini menyentuh banyak hal (UI form, dialog-dialog existing, kemungkinan sync Worker/MCP untuk debt) — bukan sekadar reorganisasi file seperti refactor `use-create-transaction` yang sudah selesai sebelumnya.

**Kenapa field UI (unit/harga, kontak) harus KONDISIONAL muncul, bukan selalu ada** — konsisten pola yang sudah ada sekarang (`needsDebtAction`/`needsInvestmentFields` di `use-transaction-form.ts`) yang menampilkan field tambahan HANYA saat akun yang dipilih bertipe relevan — prinsip ini TIDAK berubah, cuma diperluas cakupannya dari exclusive-transfer jadi juga mencakup income/expense ke akun tipe tersebut.

**Kandidat refactor `applyDebtTransaction`/`applyInvestmentTransaction`** — kedua fungsi ini SAAT INI eksplisit `if (type !== "transfer" ...) return none` (`apply-debt-transaction.ts` baris 104, `apply-investment-transaction.ts` baris 90) — kontraknya memang HANYA didesain untuk dipanggil dari jalur transfer. Jalur `direct` yang sudah ada sekarang (`new-debt-form`/`use-create-debt.ts`, lihat komentar fungsi di situ) justru TIDAK memanggil `applyDebtTransaction` sama sekali untuk mode `direct` — insert `debts` dilakukan manual langsung dari `use-create-debt.ts` sendiri (baris 82-96). Begitu form transaksi utama perlu menangani kasus direct/write-off juga, ada 2 opsi: (1) buka guard `type !== "transfer"` di kedua fungsi ini supaya bisa dipanggil juga untuk income/expense langsung ke akun debt/investment (konsisten, satu fungsi dipakai semua jalur), atau (2) tetap pakai pola insert manual terpisah seperti `use-create-debt.ts` sekarang, dipanggil dari `income.ts`/`expense.ts` yang baru. Opsi mana yang dipilih BELUM diputuskan — perlu dibahas saat domain pertama (Utang-Piutang atau Investasi) mulai dikerjakan, bukan diasumsikan sekarang.

**Kandidat refactor Form transaksi utama (`BaseForm`)** — `features/accounts` (dan sejak itu `investments`/`third-party`) sudah pindah penuh ke pola `components/forms/base-form.tsx` (`BaseForm`): komponen generik yang MEMBUAT `useForm`-nya SENDIRI secara internal dari `schema`+`defaultValues` yang diterima sebagai prop (lihat `base-form.tsx` baris 36). Form transaksi (`features/transactions/form/add-edit`) TIDAK bisa ikut pola ini apa adanya, karena `form`-nya harus SUDAH JADI dari luar — dibangun oleh `useCreateTransaction`/`useUpdateTransaction` (keduanya masih `useEntityForm`, bukan `useDbMutation`), bukan oleh komponen form itu sendiri. Sempat dicoba menggeneralisasi `BaseForm` supaya bisa menerima `form` eksternal opsional — DI-REVERT eksplisit oleh user (lihat [handover 2026-10-13](../../../../../docs/handover-session/2026-10/2026-10-13-1-migrasi-page-layout-accounts-investments-third-party-mulai-transactions.md) bagian "Catatan proses"): "ini jangan diubah, biarkan seperti awal. Ubah di wrapper transactionnya saja" — prinsip yang berlaku lintas sesi: komponen shared yang sudah dipakai banyak tempat TIDAK ditambah prop opsional demi satu pemanggil baru. Solusi SEMENTARA yang dipakai sekarang (status SEBELUM 2026-10-14, lihat update di bawah): `TransactionBaseForm` (`components/transaction-base-form.tsx`), wrapper KHUSUS transaksi yang menerima `form` sudah jadi dari luar, `FormProvider` manual — ini BUKAN penyelesaian paralel terhadap `BaseForm`, cuma workaround struktural supaya form transaksi tetap bisa jalan tanpa mengubah `BaseForm`. Refactor sesungguhnya (`use-create-transaction`/`use-update-transaction` pindah dari `useEntityForm` ke `useDbMutation`, form dibangun di level pemanggil seperti `AccountForm`) SUDAH disebut di dokumen handover sebagai pekerjaan yang DITUNDA sampai pemecahan field kompleks (`account_id`/`amount`/dst ke context) selesai — relevan untuk disatukan dengan rencana di dokumen ini, karena menambah percabangan jenis akun ke `income.ts`/`expense.ts` kemungkinan lebih mudah dilakukan SETELAH form ini pindah ke pola `BaseForm` yang sama dengan domain lain, bukan sebelumnya.

**Update 2026-10-14 — refactor `BaseForm` SELESAI untuk sisi Create, pemecahan field kompleks SELESAI.** Keduanya bukan lagi "DITUNDA" seperti disebut paragraf di atas. Lihat `features/transactions/form/add-edit/base-form-migration/README.md` untuk detail lengkap — ringkasnya:
- `TransactionFormWithBaseForm` + `useCreateTransactionBaseForm` (pola `useDbMutation`, BUKAN `useEntityForm`) — field kompleks (`account_id`/`amount`/`type`/dst) SUDAH dipecah lewat `TransactionFormFieldsProvider`/`useTransactionFormFields()` (context), bukan lagi satu `useTransactionForm()` dipanggil inline di render-prop. Setiap field jadi komponen sendiri (`FieldAccountId`, `FieldAmount`, dst), orkestrator (`TransactionFormWithBaseForm`) tinggal daftar `<FieldX/>`.
- Diverifikasi BENAR di runtime (`tauri dev` + cek `finance.dev.db` langsung, bukan cuma toast) untuk 6 kombinasi: income, expense, transfer cash↔cash/cash→debt/debt→cash/cash→investment/investment→cash — semua baris turunan (`debts`/`debt_payments`/`investment_purchases`/`investment_sales`) benar DAN masuk `cloud_sync_queue` tanpa error.
- Sisi Update (`useUpdateTransactionBaseForm`) sudah ada & lolos tipe, TAPI belum pernah dirender di `tauri dev` sama sekali — beda jauh maturity-nya dari Create.
- Folder `base-form-migration/` MANDIRI SEPENUHNYA (tidak bergantung `components/`/`hooks/`/`schema/` lama) — semua mutationFn/helper/schema sudah diduplikasi ke dalamnya, supaya migrasi final tinggal "naik pangkat" pindah lokasi tanpa menyentuh apa pun yang aktif.
- BELUM di-wire menggantikan dialog aktif (`TransactionCreateDialog`/`TransactionEditDialog`) — masih diuji lewat dialog terpisah (`TransactionCreateDialogBaseForm`, trigger tombol "Tambah (BaseForm)" sementara). Ini artinya kesimpulan paragraf sebelumnya ("menambah percabangan jenis akun ke income.ts/expense.ts lebih mudah SETELAH form ini pindah ke BaseForm") SEKARANG sudah bisa dieksekusi — prasyaratnya sudah selesai, tinggal keputusan domain mana duluan (lihat "Pekerjaan yang MASIH KOSONG").

**Verifikasi "Kasus Normal" Jalur Create (2026-10-14)** — struktur baru `use-create-transaction/create-transaction/` (`income.ts`, `expense.ts`, `transfer/index.ts` + `transfer/{cash,debt,investment}.ts`) diuji satu per satu lewat `tauri dev` + Worker lokal (`wrangler dev`), masing-masing dicek lewat salinan `finance.dev.db` (+ `-wal`/`-shm`) ke scratchpad sesuai `docs/rules/checking-dev-database.md`, dan dibandingkan dengan D1 lokal Worker (`apps/worker/.wrangler/state/v3/d1/...sqlite`): (1) income & expense biasa — INSERT benar, label ter-attach, push ke D1 sesuai; (2) transfer cash↔cash — tidak ada efek ke `debts`/`investment_*`; (3) transfer cash→debt — baris `debts` baru (`receivable`, `ongoing`); (4) transfer debt→cash (settlement) — baris `debt_payments` baru, FIFO melunasi piutang TERLAMA; (5) transfer cash→investment — baris `investment_purchases` baru (`status: pending`); (6) transfer investment→cash (jual) — `amount` dihitung ulang dari `average_cost × unit` (bukan nominal form), baris `investment_sales` baru dengan `realized_pl` benar, transaksi adjustment "Realized P/L penjualan investasi" otomatis dibuat dan ter-link via `adjustment_transaction_id`. Sempat ditemukan dan diperbaiki bug urutan push (baris turunan sempat ter-push SEBELUM leg utama `transactions` di `debt.ts`/`investment.ts`, berisiko FOREIGN KEY constraint gagal di Worker kalau race) — sudah diperbaiki, `applyLabelsAndPush` (yang push leg utama) sekarang selalu dipanggil duluan.

**Update 2026-10-14 (lanjutan) — dialog Edit (BaseForm) dibuat & diverifikasi, lampiran Create di-wire, validasi-gagal terbukti tertangkap.** Tiga pekerjaan menutup gap terbesar yang tersisa dari update sebelumnya:
- `TransactionEditDialogBaseForm` dibuat (mirror `TransactionCreateDialogBaseForm`, trigger menu "Edit (BaseForm)" di action menu list transaksi) — mematuhi kontrak `isLoading` dari `useUpdateTransactionBaseForm` (`if (isLoading) return null` sebelum mount). Diverifikasi runtime: prefill lengkap saat dialog dibuka; edit field aman (catatan/tanggal/deskripsi) pada piutang yang SUDAH dicicil tersimpan benar TANPA mengganggu `debt_payments` yang ada, sementara field berbahaya (nominal/akun/kontak) terkunci di UI dengan pesan penjelasan; transfer cash→debt dan cash→investment via edit keduanya benar di database (`debts`/`investment_purchases` + `cloud_sync_queue`). Debt→cash (settlement FIFO) dan transfer cash↔cash via Update belum dicoba.
- Dalam proses ini ditemukan bug lama (bukan regresi BaseForm, dibuktikan identik lewat `diff` dengan versi lama) — edit transfer ganti pasangan akun lintas domain investment↔debt menyisakan baris turunan yatim. Dicatat, BELUM diperbaiki — lihat checklist Jalur Update di atas.
- Lampiran di `TransactionCreateDialogBaseForm` di-wire (`pendingAttachments`/`getPendingAttachments`/`attachmentFolder` — ternyata `useCreateTransactionBaseForm` SUDAH punya opsi ini sejak awal lewat `handle-create-success.ts`, cuma belum pernah dipakai dari sisi dialog). Diverifikasi runtime: upload sebelum `transactionId` ada, submit, baris `transaction_attachments` lahir ter-link benar + masuk `cloud_sync_queue`.
- Kasus validasi-gagal dibuktikan tertangkap (gap lama "baru terbukti kasus yang lolos, belum terbukti kasus yang gagal"): `validateInvestmentFields` (status Settled tanpa unit/harga) menolak SEBELUM submit; `InsufficientInvestmentUnitsError` (oversell unit) menolak di level mutation TANPA meninggalkan baris `transactions` yatim (beda dari dialog "Jual Investasi" lama yang punya risiko itu, lihat README `create-transaction/`).

**Kenapa dipecah "Jalur Create/Update/Delete/Form" bukan per domain (debt/investment)** — perubahan ini akan menyentuh keempat jalur itu untuk KEDUA domain sekaligus (pola yang sama berulang) — memecah per jalur operasi membuat progres per operasi CRUD lebih mudah dilacak, karena satu jalur (mis. Create) kemungkinan selesai lebih dulu untuk kedua domain sebelum jalur lain (mis. Delete) disentuh sama sekali.
