# Handover — 2026-10-15 (sesi 1)

Lanjutan langsung dari rencana di [docs/todos/plan/unify-direct-writeoff-into-main-transaction-form.md](../../../apps/desktop/docs/todos/plan/unify-direct-writeoff-into-main-transaction-form.md) (dicatat sesi 2026-10-14, belum ada kode). Sesi ini: domain mana duluan DIPUTUSKAN (Utang-Piutang, lalu Investasi menyusul di sesi yang sama), dan KETIGA jalur (Create, Update, Delete) untuk KEDUA domain SELESAI + TERUJI runtime penuh via `tauri dev` + Worker lokal + database dev. Tiga bug nyata ditemukan & diperbaiki di sepanjang sesi. TIDAK ada commit sepanjang sesi ini — semua perubahan masih di working tree (satu commit terpisah sempat dibuat user di luar turn ini untuk pekerjaan refactor awal, lihat git log).

## Ringkasan hasil sesi (kronologis)

### 1. Refactor pendahuluan: pemecahan `apply-debt-transaction.ts`/`apply-investment-transaction.ts` jadi folder

Sebelum menyentuh logika baru, dua file besar (381 baris utk debt) dipecah per concern — permintaan eksplisit user ("coba pecah... namun coba analisis di sini tiap fungsinya bertanggungjawab apa saja" dulu, baru eksekusi):

- `shared/debts/apply-debt-transaction/` — `types.ts` (`TouchedDebtRows`), `create.ts` (`applyDebtTransaction`), `edit.ts` (`applyDebtTransactionEdit`, `DebtEditBlockedError`), `delete.ts` (`detachDebtForDeletedTransaction`), `settle-fifo.ts` (`settleDebtsFifo`), `index.ts` (re-export), `apply-debt-transaction.test.ts` (dipindah apa adanya), `README.md`.
- `shared/investments/apply-investment-transaction/` — pola identik (`types.ts`/`create.ts`/`edit.ts`/`delete.ts`/`index.ts`/test/`README.md`).

**Keputusan eksplisit soal komentar**: SEMUA komentar (baik docblock fungsi besar maupun inline note di titik kode spesifik) dipindah ke `README.md` masing-masing folder — file `.ts` jadi bersih kode saja. Ini preferensi baru yang berbeda dari pola sesi-sesi sebelumnya (yang biasanya tetap menyisakan inline note pendek untuk konteks di titik kode).

Semua caller tetap import dari path lama (`@/shared/debts/apply-debt-transaction`, `@/shared/investments/apply-investment-transaction`) — resolve otomatis ke `index.ts`, TIDAK ada caller yang diubah.

**Temuan penting dari README `apply-investment-transaction/`**: jalur `direct`/write-off investasi SUDAH ADA sejak sebelumnya (`new-purchase-form`, `write-off-investment-form`) dan SUDAH pernah menyebabkan 2 bug nyata (2026-10-08) saat transaksi direct itu diedit lewat form utama LAMA — `applyInvestmentTransactionEdit` sudah punya fix (UPDATE in-place utk `type !== 'transfer'`, fallback nilai lama kalau field null karena race React Query). Fix ini jadi relevan langsung untuk pekerjaan sesi ini.

### 2. Jalur Create — domain Utang-Piutang (SELESAI + TERUJI runtime)

`create-transaction/income.ts`/`expense.ts` (file tunggal, cuma cash) direstrukturisasi jadi folder `income/`/`expense/` — `index.ts` (orkestrator, `getAccountType`) + `cash.ts` (logika existing dipindah apa adanya) + `debt.ts` (BARU) — simetris pola `transfer/{index,cash,debt,investment}.ts` yang sudah ada.

**Keputusan desain (dipertanyakan via AskUserQuestion, dipilih user)**: `applyDebtTransaction` TETAP guard `type !== 'transfer'` (TIDAK dibuka) — income/expense direct ke akun `debt` insert manual terpisah (`income/debt.ts`/`expense/debt.ts`), mirror pola lama `use-create-debt.ts` jalur `direct`. Arah `receivable`/`payable` diambil dari `type` transaksi itu sendiri (income=receivable, expense=payable) — **TIDAK perlu field form baru sama sekali**, `contact_name` yang sudah ada dipakai sebagai kontak.

**Bug ditemukan & diperbaiki — guard UI usang**: `use-transaction-form.ts` punya 2 `useEffect` yang MEMAKSA `type` jadi `"transfer"` begitu `account_id` terdeteksi bertipe `debt` (dipasang komit `a12ca24`, 2026-10-13, sebagai safety net SEBELUM backend bisa menangani kasus ini — komentar asli: "dipilih di income/expense akan 'tersimpan' tapi TIDAK PERNAH tercatat sebagai piutang/utang, bug senyap"). Backend sekarang siap, guard DIHAPUS sepenuhnya. `involvesDebtAccount` di `use-transaction-debt-fields.ts` sudah otomatis benar tanpa diubah (dihitung dari tipe akun, bukan exclusive transfer).

**Diverifikasi runtime** ("Test Piutang" income, "Test Utang" expense, akun debt "Piutang"): baris `debts` benar (`receivable`/`payable`, `status: ongoing`), masuk `cloud_sync_queue`, push ke D1 lokal sukses.

### 3. Jalur Create — domain Investasi (SELESAI + TERUJI runtime, BUG RACE CONDITION ditemukan dari log Worker)

Pola sama dengan debt, tapi investasi punya 2 arah direct (bukan 1): `income` ke akun investment = pembelian direct (`income/investment.ts`, insert `investment_purchases` manual `status: 'settled'` selalu), `expense` ke akun investment = write-off (`expense/investment.ts`, `amount` DIHITUNG ULANG dari `averageCost × unit` — BUKAN nominal form, insert `investment_sales` dengan `price_per_unit: 0`, `adjustment_transaction_id: NULL`, validasi oversell).

**Field UI BARU ditambah** (beda dari debt): `use-transaction-investment-fields.ts` diperluas 2 varian — `needsInvestmentDirectBuyFields` (unit/harga wajib, toggle status Pending/Settled disembunyikan — direct SELALU settled) dan `needsInvestmentWriteOffFields` (unit wajib, `price_per_unit` field DISEMBUNYIKAN karena implisit 0, amount auto-compute+disabled sama pola `needsInvestmentSellFields`/jual). `field-investment.tsx`/`field-amount.tsx` diupdate untuk ketiga varian.

**Bug NYATA pertama ditemukan dari log `wrangler dev` user** (bukan dugaan baca kode): `D1_ERROR: FOREIGN KEY constraint failed` saat push `investment_purchases`/`investment_sales`. Root cause: `income/debt.ts`, `expense/debt.ts`, `income/investment.ts`, `expense/investment.ts` semua menulis `void pushOnWrite(derived, ...)` SEBELUM `await applyLabelsAndPush(...)` (push leg utama `transactions`) — race, baris turunan kadang sampai ke Worker sebelum `transactions`-nya sendiri ada. Fix: urutan dibalik (await `applyLabelsAndPush` dulu, baru `void pushOnWrite` baris turunan) di keempat file. Ini persis bug yang sudah pernah diperbaiki di `transfer/debt.ts`/`transfer/investment.ts` sesi 2026-10-14 — lupa diterapkan konsisten ke file baru.

**Diverifikasi runtime** ("Test Income Investasi", "Test Expense Investasi"): setelah fix, baris `investment_purchases`/`investment_sales` benar (`average_cost_per_unit` dihitung ulang BUKAN dari form, `realized_pl` negatif penuh), berhasil push ke D1.

### 4. Jalur Update — domain Utang-Piutang & Investasi (SELESAI + TERUJI runtime, BUG KEDUA ditemukan)

`update-transaction/income.ts`/`expense.ts` direstrukturisasi sama pola Create. `update-transaction/index.ts` dirapikan: `dangerousFieldsChanged` (sebelumnya cuma dihitung di cabang transfer) dipindah ke atas untuk tersedia di ketiga cabang.

- `income/debt.ts`/`expense/debt.ts` (BARU, ditulis manual): TIDAK bisa pakai `applyDebtTransactionEdit` apa adanya (delegasi ke `applyDebtTransaction` yang exclusive transfer) — mereplikasi matriks keputusan `role × dangerousFieldsChanged × hasPayments` yang sama dari `apply-debt-transaction/edit.ts`. `role: 'payment'` dianggap state tidak konsisten untuk income/expense direct (payment cuma lahir dari transfer debt→cash/settlement) — throw error.
- `income/investment.ts`: pakai `applyInvestmentTransactionEdit` LANGSUNG tanpa modifikasi — fungsi ini SUDAH generic menangani `type !== 'transfer'` (fix bug 2026-10-08 lama).
- `expense/investment.ts` (write-off edit): memanggil `applyWriteOffInvestmentTransactionEdit` + `getTransactionWriteOff` — **PENEMUAN PENTING: kedua fungsi ini sudah ditulis & punya unit test sejak sebelumnya, TAPI TIDAK PERNAH dipanggil dari production code manapun** (komentar fungsi itu sendiri bilang "dipanggil dari form transaksi UTAMA", padahal belum pernah terwujud). Sesi ini PERTAMA KALI mewujudkan pemanggilan itu. Validasi oversell dikompensasi balik (`remainingUnit + unitLama >= unitBaru`) karena `getRemainingUnit` sudah mengurangkan baris write-off ITU SENDIRI.

**Bug KEDUA ditemukan & diperbaiki — push hilang (bukan race)**: di `income/debt.ts`/`expense/debt.ts`, cabang `!dangerousFieldsChanged` (UPDATE in-place field aman) melakukan `UPDATE debts` tapi TIDAK PERNAH set `newDebtId` — `void pushOnWrite("debts", newDebtId)` di akhir fungsi tidak pernah terpanggil untuk kasus ini. Data tersimpan BENAR di lokal, TIDAK PERNAH dikirim ke Worker (bukan gagal-lalu-retry — `pushOnWrite` memang tidak pernah dicoba, tidak ada entri di `cloud_sync_queue` untuk diselidiki). Dibuktikan nyata: `debts.note` di D1 tetap nilai LAMA padahal `transactions.note` sudah benar. Fix: `newDebtId = status.debtId` ditambahkan.

**Diverifikasi runtime** (edit field aman via dialog Edit BaseForm): "Test Piutang"→"(Editted)", "Test Utang"→"(Editted)", "Test Income/Expense Investasi"→edit note — semua `id` baris turunan TETAP SAMA (UPDATE in-place, bukan recreate, karena field berbahaya tidak diubah), setelah fix push kedua sinkron ke D1. **Juga diverifikasi**: "Kasus Normal" Jalur Update ("Test Case Normal", income/expense cash biasa, termasuk GANTI `type` dari expense→income) — sinkron penuh.

**BELUM dicoba**: edit field berbahaya (recreate/blokir) untuk debt/investment direct; transfer cash↔cash dan debt→cash settlement FIFO via Update.

### 5. Jalur Delete — KEDUA domain (TIDAK PERLU KODE BARU SAMA SEKALI, TERUJI runtime)

Analisis `use-delete-transaction.ts` (hook delete tunggal, sudah ada SEBELUM dokumen plan ini dibuat): sejak awal didesain generic by `transactionId` — `detachDebtForDeletedTransaction`/`detachInvestmentPurchaseForDeletedTransaction`/`detachInvestmentSaleForDeletedTransaction` semua query `WHERE transaction_id = $1` murni, tidak pernah bercabang berdasarkan `type` transaksi atau tipe akun. `detachInvestmentSaleForDeletedTransaction` juga tidak membedakan jual biasa vs write-off — guard `if (adjustmentId != null)` di `deleteInvestmentSaleAndAdjustment` sudah mencegah percobaan delete adjustment yang salah untuk write-off (`adjustment_transaction_id` selalu NULL).

**Diverifikasi runtime, keempat kasus, semua BERHASIL tanpa kode baru**: hapus "Test Piutang (Editted)" (debt — `debts` row tetap ada, `transaction_id` SET NULL, nominal utuh), "Test Income Investasi (Editted)" (investment purchase — `investment_purchases` hard-delete total, beda dari debt), "Test Expense Investasi (Editted)" (write-off — `investment_sales` hard-delete total, queue BERSIH TOTAL kali ini), "Test Case Normal (Editted)" (cash biasa). Semua soft-delete (`deleted_at`) identik di D1.

**Temuan infrastruktur minor (BUKAN bug dari sesi ini, diselidiki & dikonfirmasi)**: pada kasus hapus investment purchase, entri `cloud_sync_queue` sempat tertinggal (`attempts: 0`, tanpa error) padahal D1 sudah konsisten. Diselidiki: `created_at` entri itu PERSIS sama detik dengan `deleted_at` di D1 — pola khas request HTTP sukses di server tapi client (`fetch()`) menganggap gagal/timeout. `use-delete-transaction.ts` TIDAK disentuh sesi ini, logikanya sudah benar — race murni network/timing `wrangler dev` lokal, tidak berulang di percobaan delete berikutnya (write-off, queue bersih total).

## Status kode saat ini

- **`shared/debts/apply-debt-transaction/`** dan **`shared/investments/apply-investment-transaction/`**: folder baru, pemecahan murni (tidak ada perubahan logika), semua test lolos (91 total gabungan).
- **`create-transaction/income/`, `create-transaction/expense/`**: folder baru (`index.ts`/`cash.ts`/`debt.ts`/`investment.ts`), menggantikan file flat lama.
- **`update-transaction/income/`, `update-transaction/expense/`**: folder baru, pola sama create. `update-transaction/index.ts` diubah (hitung `dangerousFieldsChanged` dipindah ke atas).
- **`use-transaction-form.ts`**: guard `sourceIsDebt` (2 `useEffect`) DIHAPUS total, termasuk import `useEffect`/`useRef` yang jadi tidak terpakai.
- **`use-transaction-investment-fields.ts`**: 2 varian baru (`needsInvestmentDirectBuyFields`, `needsInvestmentWriteOffFields`), diteruskan lewat `use-transaction-form.ts` ke context.
- **`field-investment.tsx`, `field-amount.tsx`**: diupdate menangani varian buy/sell/write-off direct.
- **`apply-write-off-investment-transaction.ts`**: TIDAK diubah sama sekali, tapi `applyWriteOffInvestmentTransactionEdit`/`getTransactionWriteOff` sekarang PUNYA CALLER PERTAMA (`update-transaction/expense/investment.ts`) — sebelumnya yatim.
- **`use-delete-transaction.ts`**: TIDAK diubah sama sekali — sudah benar sejak awal.
- **`apps/desktop/.gitignore`**: ditambah `tsconfig.tsbuildinfo` + `git rm --cached` (file ini sebelumnya ter-track tidak sengaja, noise di diff tiap `tsc` jalan) — perubahan ini BELUM di-commit, masih staged.
- **`docs/todos/plan/unify-direct-writeoff-into-main-transaction-form.md`**: checklist Create/Update/Delete untuk Normal+Utang Piutang+Investasi SEMUA dicentang `[x]`, dengan paragraf naratif detail per update tanggal di bagian "Detail & rasional keputusan". Checklist Form (field debt/investment, keputusan `record_mode`) dan Refactor (`applyDebtTransaction`/`applyInvestmentTransaction` guard) juga dicentang.
- TIDAK ada commit sepanjang sesi ini.

## Gap yang TERSISA untuk sesi berikutnya

1. **Edit field berbahaya (recreate/blokir) untuk debt & investment direct belum dicoba manual** — logika sudah ditulis (mereplikasi matriks `apply-debt-transaction/edit.ts`), tapi hanya edit field AMAN (note) yang diverifikasi runtime sesi ini. Perlu dicoba: ganti `amount`/`account_id`/`contact_name` pada transaksi direct yang sudah ada, termasuk kasus `hasPayments` (harus blokir `DebtEditBlockedError`).
2. **Transfer cash↔cash dan debt→cash (settlement FIFO) via Update belum pernah dicoba** — gap lama dari sesi 2026-10-14, belum tertutup sesi ini.
3. **Bug lama transfer ganti pasangan akun lintas domain (investment↔debt) menyisakan baris turunan yatim** — ditemukan 2026-10-14, MASIH belum diperbaiki, lihat [docs/dogfooding/2026-10-14-transfer-ganti-pasangan-akun-silang-investment-debt-sisakan-baris-yatim.md](../../dogfooding/2026-10-14-transfer-ganti-pasangan-akun-silang-investment-debt-sisakan-baris-yatim.md).
4. **Nasib dialog/form lama** (`new-debt-form`, `new-purchase-form`, `write-off-investment-form`) masih "CONDONG dihapus, belum final" — sekarang KETIGA jalur CRUD form utama sudah solid untuk kedua domain, jadi diskusi penghapusan ini relevan dibuka lagi. Tools MCP (`create_debt_direct`, `create_investment_purchase_direct`, `write_off_investment`) perlu dicek dulu sebelum dialog lama dihapus — TIDAK otomatis ikut terhapus.
5. **`third_party`** (lihat `account-type-third-party.md`) disebut dokumen plan sebagai kandidat yang BISA mengikuti pola sama sejak awal (belum pernah dibangun di dialog terpisah) — belum dibahas ulang sesi ini.
6. **`apps/desktop/.gitignore` + untrack `tsconfig.tsbuildinfo` belum di-commit** — user bilang akan commit sendiri nanti.
7. **Belum ada pengujian kasus error/edge** untuk jalur direct baru (selain validasi oversell write-off yang sudah ada by design) — mis. akun debt/investment terhapus di antara submit & eksekusi, dua kali submit cepat (double-submit race).

## Catatan proses (feedback untuk sesi berikutnya)

- **"Semua komentar ke README, file .ts bersih kode"** — keputusan eksplisit baru sesi ini untuk pemecahan `apply-*-transaction.ts` (lihat poin 1). Beda dari pola sebelumnya yang biasa menyisakan inline note pendek. Terapkan preferensi ini kalau diminta memecah file besar lagi — TANYA DULU kalau ambigu, jangan asumsikan salah satu default.
- **AskUserQuestion dipakai aktif untuk keputusan desain bercabang** (buka guard vs insert manual terpisah; field UI baru vs tunda; dispatch strategi update) — semua dijawab cepat dengan opsi "Recommended" yang disodorkan. Pola ini efektif untuk sesi dengan banyak keputusan arsitektur kecil berurutan — pertahankan menyodorkan rekomendasi jelas, bukan netral, supaya user bisa langsung terima/tolak.
- **Verifikasi `docs/rules/checking-dev-database.md` dipakai KETAT untuk SETIAP langkah kecil**, bukan sekali di akhir — baseline diambil SEBELUM tiap sesi edit/create/delete, dibandingkan dengan snapshot sesudah, SELALU cross-check ke D1 lokal Worker (bukan cuma SQLite lokal). Dua bug nyata (race condition push, push hilang) HANYA ketemu karena displin ini — kalau cuma percaya toast sukses UI, kedua bug itu tidak akan pernah ketahuan.
- **User melaporkan log error Worker secara proaktif** ("Di log ada error begini...") di tengah proses — ini jadi sumber utama bug pertama ditemukan (FOREIGN KEY constraint). Kebiasaan ini sangat berguna, pertahankan: minta user share log `wrangler dev` kalau testing manual melibatkan push ke Worker.
- **Satu temuan "aneh" (entri queue tertinggal) TIDAK langsung diasumsikan bug baru** — diselidiki dulu (`created_at` vs `deleted_at` di D1) sebelum disimpulkan sebagai race infrastruktur yang sudah ada, bukan regresi. User diberi pilihan "catat sebagai observasi" vs "selidiki lebih dalam dulu" via AskUserQuestion, memilih yang kedua — pelajaran: jangan terlalu cepat menandai temuan ambigu sebagai "bukan masalah", biarkan user memutuskan tingkat investigasi yang diinginkan.
- **Dokumen plan terus diupdate INKREMENTAL setiap selesai satu kasus** (bukan ditunda sampai akhir sesi) — checklist diringkas jadi 1 baris + pointer "lihat catatan di bawah" begitu mulai panjang (instruksi eksplisit: "Tulis singkat saja di ceklis"), detail lengkap selalu masuk paragraf naratif "Update <tanggal> (lanjutan)" di bagian "Detail & rasional keputusan". Pertahankan pola ini — checklist untuk status sekilas, paragraf naratif untuk konteks penuh.
