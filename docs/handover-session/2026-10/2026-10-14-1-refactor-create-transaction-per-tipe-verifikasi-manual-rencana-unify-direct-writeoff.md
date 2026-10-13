# Handover — 2026-10-14 (sesi 1)

Lanjutan langsung dari [handover 2026-10-13](2026-10-13-1-migrasi-page-layout-accounts-investments-third-party-mulai-transactions.md) — gap "Fokus utama: lanjutkan rapi-rapi `features/transactions/form`" di situ. Sesi ini: (1) `use-create-transaction` dipecah total jadi struktur per-tipe transaksi (SELESAI, diverifikasi manual lewat `tauri dev` + database dev + Worker lokal), (2) ditemukan gap arsitektur besar (form transaksi utama tidak bisa menangani kasus "direct"/"write-off" piutang & investasi) yang dicatat sebagai dokumen plan baru, (3) dibuat patokan migrasi ke pola `BaseForm` untuk jalur Create (belum di-wire, dipisah ke folder sendiri). TIDAK ada commit sepanjang sesi ini — SEMUA perubahan masih di working tree.

## Ringkasan hasil sesi (kronologis)

### 1. `createTransaction` dipecah total per tipe transaksi (SELESAI)

Berangkat dari gap tersisa sesi 2026-10-13 ("field kompleks belum dipecah"), tapi arah kerjanya justru ke `use-create-transaction` dulu (bukan field form) — dipicu permintaan eksplisit "pisahkan dulu type/interface ke file terpisah" lalu berkembang jadi refactor penuh.

**Urutan pemecahan** (`hooks/use-create-transaction/`):
1. `type.ts` dipisah dari `index.ts` (`UseCreateTransactionOptions`), JSDoc per field dipindah ke `README.md`.
2. `mutationFn` (body besar, 9 tahap) diekstrak jadi fungsi `createTransaction(values)` di `create-transaction.ts`, lalu file itu sendiri di-nested jadi `create-transaction/index.ts` (permintaan eksplisit: "bikin jadi index.ts, pindahkan ke folder create-transaction yang baru saya buat").
3. Dipecah lagi per `values.type`: `create-transaction/income.ts`, `create-transaction/expense.ts` (income/expense ke akun cash biasa — tidak ada percabangan jenis akun, keduanya cuma INSERT + label/push), `create-transaction/index.ts` jadi orkestrator yang cabang ke income/expense/transfer.
4. `transfer` dipecah LAGI per pasangan jenis akun (permintaan eksplisit user: "saya masih lebih prefer percabangan per tipe... masing-masing tipe ada percabangan lagi sesuai tipe akunnya") — `transfer/index.ts` (orkestrator, deteksi `classifyAccountPair`) + `transfer/cash.ts` (cash-cash) + `transfer/debt.ts` (cash-debt/debt-cash/debt-debt) + `transfer/investment.ts` (cash-investment/investment-cash).
5. Helper bersama dipisah ke `hooks/helper/` (BUKAN di dalam `use-create-transaction/`, levelnya naik supaya bisa dipakai `use-update-transaction` juga nanti): `insert-to-db.ts` (`insertTransactionToDb`, satu-satunya query INSERT) + `apply-labels-and-push.ts` (`applyLabelsAndPush`, push leg utama + label — WAJIB dipanggil SEBELUM push baris turunan).
6. Helper `getAccountType` (duplikat di 2+ tempat) dipindah user sendiri ke `lib/helper-db/get-account-type.ts`, lalu saya relokasi ke `lib/db/helper/` (barrel `index.ts` + `README.md`) — `lib/db.ts` sendiri juga sempat direstruktur jadi folder `lib/db/{get-db.ts,types.ts,index.ts,README.md}` di awal sesi (permintaan terpisah, sebelum fokus ke transactions).

**Bug ditemukan & diperbaiki selama pemecahan**: urutan push di `transfer/debt.ts` dan `transfer/investment.ts` sempat TERBALIK (push baris turunan `debts`/`investment_purchases`/dll SEBELUM push leg utama `transactions`) — berisiko FOREIGN KEY constraint gagal di Worker kalau race (persis bug "Tahap 5" yang sudah pernah terjadi, disebut di komentar kode asli). Sudah diperbaiki: `applyLabelsAndPush` (push leg utama) sekarang SELALU dipanggil duluan di kedua file.

### 2. Verifikasi manual penuh via `tauri dev` + database dev + Worker lokal (SELESAI)

User menjalankan `tauri dev` + `wrangler dev` (port 8787) sendiri, saya verifikasi tiap kasus lewat `docs/rules/checking-dev-database.md` (copy `finance.dev.db`+`-wal`+`-shm` ke scratchpad, bandingkan dengan D1 lokal Worker di `apps/worker/.wrangler/state/v3/d1/`). Semua kasus LOLOS:

- **Income/expense biasa** — INSERT benar, label ter-attach ("Mandiri"/"Konsumtif"), push ke D1 sesuai.
- **Transfer cash↔cash** — tidak ada efek ke `debts`/`investment_*`.
- **Transfer cash→debt** — baris `debts` baru (`receivable`, `ongoing`).
- **Transfer debt→cash (settlement)** — baris `debt_payments` baru, FIFO melunasi piutang TERLAMA (bukan yang baru dibuat).
- **Transfer cash→investment (beli)** — baris `investment_purchases` baru (`status: pending`).
- **Transfer investment→cash (jual)** — `amount` dihitung ulang dari `average_cost × unit` (bukan nominal form), baris `investment_sales` baru dengan `realized_pl` benar, transaksi adjustment "Realized P/L penjualan investasi" otomatis dibuat + ter-link via `adjustment_transaction_id`.

Baseline sebelum pengujian: `transactions` 5558 baris, `debts` 21, `debt_payments` 5, `investment_purchases`/`investment_sales` 0 (TIDAK ADA akun bertipe `investment` di dev db ini sebelum sesi — user bikin akun baru "Akun Investasi" di tengah pengujian).

### 3. Gap arsitektur besar ditemukan — dicatat sebagai dokumen plan baru (BELUM dikerjakan)

Diskusi dipicu pertanyaan "memungkinkan tidak utang piutang berubah tanpa transfer?" — jawabannya YA (`record_mode: 'direct'` di `new-debt-form`, dan write-off), begitu juga investasi (direct purchase + write-off unit, lihat `konsep-investasi.md` bagian "Unit yang berubah TANPA transfer kas", termasuk bug nyata 2026-10-08 yang sudah diperbaiki di situ). Tapi kedua jalur itu TERPISAH dari `createTransaction` yang baru direfactor — form transaksi utama "secara arsitektur SELALU insert satu baris `transactions` begitu disubmit", `income`/`expense` di situ TIDAK bercabang per jenis akun tujuan (beda dari `transfer` yang sudah bercabang via `classifyAccountPair`).

User eksplisit: form transaksi utama SEHARUSNYA bisa menangani kasus ini juga — arah besarnya MENYATUKAN jalur direct/write-off ke `income.ts`/`expense.ts` yang baru, bukan dibiarkan terpisah selamanya. Instruksi eksplisit: "catat dulu di todos/plan" — BELUM ada kode untuk ini.

Dokumen baru: `apps/desktop/docs/todos/plan/unify-direct-writeoff-into-main-transaction-form.md` — checklist dipecah per jalur operasi (**Create → Update → Delete → Form**, bukan per domain tipe akun), tiap item 1 baris ringkas (instruksi eksplisit user, 2x revisi format sampai pas). Sub-heading tambahan: "Nasib dialog/form lama" (condong dihapus, belum final) dan **"Refactor"** (2 kandidat konkret + 1 yang ditemukan terakhir):
- `applyDebtTransaction`/`applyInvestmentTransaction` — keduanya `return none` kalau `type !== 'transfer'`, perlu dibuka kontraknya.
- Form transaksi utama masih `TransactionBaseForm` (wrapper workaround), BELUM `BaseForm` generik — history lengkap kenapa (percobaan generalisasi `BaseForm` di-revert eksplisit user sesi 2026-10-13) ada di bagian "Detail & rasional keputusan" dokumen ini.

Checklist "Kasus Normal" di Jalur Create sudah ditandai `[x]` (hasil kerja poin 1-2 di atas), sisanya semua masih `[ ]`.

### 4. Patokan migrasi ke `BaseForm` untuk jalur Create (BELUM di-wire, dipisah folder)

Permintaan eksplisit: buat `TransactionForm` versi `BaseForm` langsung (bukan `TransactionBaseForm`) SEBAGAI PATOKAN, belum di-wire. Dibuat lalu dipindah ke folder terpisah `base-form-migration/` (permintaan eksplisit: "pisahkan dalam folder antara komponen baru dan lama agar tidak bingung nanti ketika bersih bersihnya") — mirror struktur `components/`/`hooks/` yang lama:

```
features/transactions/form/add-edit/base-form-migration/
  README.md
  components/transaction-form-with-base-form.tsx   (TransactionFormWithBaseForm)
  hooks/use-create-transaction/
    index-base-form.ts      (useCreateTransactionBaseForm, pola useCreateAccount)
    type-base-form.ts        (UseCreateTransactionBaseFormOptions, lebih ramping)
    handle-create-success.ts (onSuccess dipisah, pola sama createTransaction)
```

`createTransaction` (mutationFn) SENGAJA TIDAK ikut dipindah — tetap di lokasi lama (`hooks/use-create-transaction/create-transaction/`), di-reuse langsung, karena dipakai BERSAMA versi lama & patokan baru.

**Terbukti kompatibel secara TIPE** (dibuktikan dengan file `wiring-proof.tsx` sementara yang menyambungkan `TransactionFormWithBaseForm` + `useCreateTransactionBaseForm`, lolos `tsc --noEmit`, lalu dihapus setelah terbukti — bukti sudah cukup, filenya sendiri tidak perlu dipertahankan). **BELUM terbukti secara perilaku runtime** (belum pernah dirender di `tauri dev`). **Update sama sekali belum disentuh** — kerumitan tambahan yang belum dipikirkan: `defaultValues` async (`useContacts`/`useTransactionDebtStatus`/dst), sinkronisasi manual `label_names` (bug nyata 2026-10-10), validasi blokir edit (`DebtEditBlockedError`).

## Status kode saat ini

- **`use-create-transaction`**: SELESAI direfactor + diverifikasi manual penuh (lihat poin 1-2). Struktur final: `index.ts` (tipis) → `type.ts`, `create-transaction/{index.ts,income.ts,expense.ts,transfer/{index,cash,debt,investment}.ts}`, masing-masing dengan `README.md`.
- **`hooks/helper/`**: baru, 2 fungsi bersama (`insertTransactionToDb`, `applyLabelsAndPush`), dipakai oleh SEMUA file kasus `create-transaction/`.
- **`lib/db/`**: direstruktur dari `lib/db.ts` flat jadi folder (`get-db.ts`/`types.ts`/`index.ts`/`README.md`) — import `@/lib/db` TIDAK berubah di 178 file importer (transparan lewat barrel).
- **`lib/db/helper/`**: baru, `getAccountType` dipindah ke sini dari `lib/helper-db/` (lokasi sementara user), dipakai `use-create-transaction` DAN `use-update-transaction` (ganti fungsi lokal duplikat).
- **`use-update-transaction`**: BELUM disentuh sama sekali sesi ini (selain ganti 1 baris import `getAccountType` ke helper baru) — masih full `useEntityForm`, monolitik.
- **`base-form-migration/`**: baru, terisolasi penuh, siap dihapus 1 unit kalau dibatalkan atau "naik pangkat" kalau dilanjutkan.
- **`docs/todos/plan/unify-direct-writeoff-into-main-transaction-form.md`**: baru, rencana besar yang BELUM dikerjakan sama sekali (checklist semua `[ ]` kecuali "Kasus Normal" Jalur Create).
- TIDAK ada commit sepanjang sesi — `git status` menunjukkan `transaction-base-form.tsx` (modified — HANYA hilang trailing newline, bukan perubahan substansial, aman diabaikan atau dirapikan kapan saja), `tsconfig.tsbuildinfo` (otomatis), dan folder baru `base-form-migration/` (untracked).

## Gap yang TERSISA untuk sesi berikutnya

1. **Keputusan domain mana duluan untuk "unify direct/write-off"** — Utang-Piutang (lebih sederhana) vs Investasi (lebih kompleks, tapi sudah pernah ada bug nyata dari gap serupa) — BELUM diputuskan, lihat dokumen plan bagian "Pekerjaan yang MASIH KOSONG".
2. **`use-update-transaction` belum direfactor sama sekali** — baik ke struktur per-tipe (seperti create) maupun ke pola `BaseForm`. Kerumitan tambahan edit (data async, sinkronisasi manual, validasi blokir) perlu dipikirkan SEBELUM asal tiru pola create.
3. **Field kompleks form (`account_id`/`amount`/`category_id`/dst) MASIH belum dipecah ke context terpisah** — baik di `components/index.tsx` (versi lama/aktif) maupun di `base-form-migration/` (versi patokan, masih manggil `useTransactionForm()` langsung di render-prop). Rencana context pembungkus dari handover 2026-10-13 BELUM dieksekusi — kemungkinan jadi prasyarat sebelum field `account_id`/`category_id` bisa bercabang per jenis akun (kebutuhan "unify direct/write-off").
4. **Kandidat refactor `applyDebtTransaction`/`applyInvestmentTransaction`** — guard `type !== 'transfer'` perlu dibuka ATAU tetap insert manual terpisah (2 opsi, belum diputuskan) — relevan begitu domain pertama "unify" mulai dikerjakan.
5. **Nasib dialog/form lama** (`new-debt-form`, `new-purchase-form`, `write-off-investment-form`) — condong dihapus setelah form utama solid, TAPI belum final, dan ada ketergantungan MCP (`create_debt_direct`, dkk) yang perlu dicek dulu sebelum dihapus.
6. **`transaction-base-form.tsx` kehilangan trailing newline** — perubahan tidak sengaja (bukan dari saya, kemungkinan editor user), aman dibiarkan atau dirapikan kapan saja, TIDAK mempengaruhi fungsi.
7. **Belum ada pengujian untuk kasus error/edge** di jalur baru `create-transaction/` — baru kasus "jalur sukses" yang diverifikasi (6 kombinasi di atas), BELUM diuji: validasi oversell gagal (jual investasi melebihi unit), akun sudah terhapus di antara submit & eksekusi, dll.

## Catatan proses (feedback untuk sesi berikutnya)

- **Pola "buat dulu sebagai patokan, JANGAN di-wire"** dipakai BERULANG KALI sesi ini (file `BaseForm`, hook `useCreateTransactionBaseForm`, bahkan `wiring-proof.tsx` yang sengaja dihapus setelah tujuannya tercapai) — user secara eksplisit memisahkan "buktikan secara struktural/tipe" dari "pasang sungguhan". JANGAN mengira file patokan otomatis berarti siap dipakai — selalu cek komentar header file (ditulis eksplisit "BELUM di-wire, JANGAN diimpor") sebelum menyarankan pemakaian.
- **Pemisahan file/folder makin granular secara progresif** — sesi ini menunjukkan preferensi memecah HAMPIR SEGALA SESUATU ke file sendiri begitu ada >1 tanggung jawab berbeda dalam satu file (type diekstrak, mutationFn diekstrak, lalu di-nested ke folder, lalu dipecah lagi per kasus, lalu helper-nya dipisah lagi) — pola berulang: user memandu satu langkah kecil setiap kali, bukan sekaligus besar, dan sering meminta verifikasi `tsc --noEmit` di titik-titik kecil ini.
- **Folder terpisah untuk kode eksperimental/migrasi** (`base-form-migration/`) adalah pola BARU sesi ini — kemungkinan akan dipakai lagi untuk migrasi besar lain yang belum pasti arahnya (bukan cuma transactions). Pertimbangkan pola ini proaktif kalau ada permintaan serupa ("buat versi baru dari X tanpa mengganggu yang lama") di fitur lain.
- **Dokumen plan WAJIB ceklis super ringkas 1 baris per item** — user merevisi 2x sampai formatnya pas (awalnya saya buat terlalu detail per item, lalu terlalu panjang per sub-heading) — pelajaran: untuk dokumen plan baru, mulai dari struktur paling ringkas dulu (1 baris, label kasus singkat), baru perluas HANYA kalau diminta, jangan berasumsi detail yang membantu itu otomatis diinginkan.
- **"Catat dulu, jangan coding"** adalah sinyal eksplisit yang harus dihormati ketat — begitu user bilang "catat di todos/plan" untuk sebuah ide besar, JANGAN sekalipun menulis kode terkait ide itu di sesi yang sama kecuali diminta ulang secara eksplisit terpisah (seperti yang terjadi: dokumen dicatat dulu, BARU kemudian diminta eksplisit "coba buat ini" untuk patokan `BaseForm`).
- **Verifikasi manual (`docs/rules/checking-dev-database.md`) dipakai SERIUS, bukan formalitas** — tiap kasus transfer diverifikasi SATU PER SATU (bukan sekali di akhir), termasuk cross-check ke Worker lokal (D1), bukan cuma SQLite lokal. Pertahankan kebiasaan ini untuk perubahan apa pun yang menyentuh mutation/write path.
