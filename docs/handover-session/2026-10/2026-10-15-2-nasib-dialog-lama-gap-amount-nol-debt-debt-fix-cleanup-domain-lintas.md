# Handover — 2026-10-15 (sesi 2)

Lanjutan langsung dari [sesi 1 hari yang sama](2026-10-15-1-unify-direct-writeoff-debt-investment-create-update-delete-teruji-runtime.md) (unifikasi direct/write-off ke form transaksi utama, KETIGA jalur CRUD sudah solid untuk domain Utang-Piutang & Investasi). Sesi ini membahas "nasib dialog lama" yang jadi gap terbuka di sesi 1, lalu melebar ke tiga topik lain lewat diskusi beruntun: gap `amount=0` untuk direct-buy investment, perilaku transfer `debt-debt`, dan — temuan PALING PENTING — bug "ganti pasangan akun lintas domain" (2026-10-14, sebelumnya dikira cuma investment↔debt) ternyata JAUH lebih luas scope-nya dan sudah DIPERBAIKI di desktop DAN Worker. Semua perubahan kode SUDAH ada di working tree, BELUM di-commit.

## Ringkasan hasil sesi (kronologis)

### 1. Nasib dialog lama (`new-debt-form`, `new-purchase-form`, `write-off-investment-form`) — DIPUTUSKAN & dieksekusi

Dicek dulu: ketiga dialog ini TIDAK yatim — semua masih aktif dirender (`NewDebtDialog` di `/debts/receivables`, `/debts/payables`, header `debts-summary`; `NewInvestmentPurchaseDialog`+`WriteOffInvestmentDialog` di header `/investments/detail`). Ditemukan: `new-debt-form`/`new-purchase-form` punya field `record_mode: 'transfer' | 'direct'` — mode `'direct'`-nya PERSIS terduplikasi logic dengan jalur direct form utama yang baru dibangun sesi 1 (insert manual `transactions`+`debts`/`investment_purchases`, tanpa lewat `applyDebtTransaction`/`applyInvestmentTransaction`).

**Keputusan (dipilih user via AskUserQuestion)**: hapus mode `'direct'` dari kedua dialog, PERTAHANKAN dialog untuk mode `'transfer'` saja (shortcut context-locked yang valid secara UX — bukan redundan, cuma mode direct-nya yang duplikat).

- `new-debt-form`: `schema.ts` (hapus `record_mode`, `cash_account_id` jadi wajib selalu), `use-create-debt.ts` (hapus cabang direct), `new-debt-form.tsx` (hapus toggle, field kas selalu tampil).
- `new-purchase-form`: pola sama — `schema.ts` (`amount` berubah dari `nonnegative` jadi `positive`, karena mode transfer yang tersisa selalu ada kas keluar riil), `use-create-investment-purchase.ts`, `new-investment-purchase-form.tsx`.
- `write-off-investment-form`: TIDAK disentuh — tidak pernah punya `record_mode` (write-off selalu semantiknya "direct"), di luar scope.
- **Tools MCP** (`create_debt_direct`, `create_investment_purchase_direct`, `write_off_investment`) — dicek, TIDAK perlu diubah. Memanggil Worker HTTP API langsung (bukan SQLite desktop), jalur tulis yang SENGAJA independen dari dialog desktop (lihat `apps/worker/src/modules/sync/README.md`: "D1 punya 2 sumber tulis: PC dan tool MCP").

`tsc --noEmit` bersih, 246 test vitest lulus setelah perubahan ini.

### 2. Gap `amount=0` ditemukan & ditutup (form transaksi utama)

Saat menghapus mode direct `new-purchase-form`, ditemukan rasional tertulis yang terlewat (`konsep-investasi.md` baris 148): `amount=0` VALID untuk direct-buy investment ("saldo & unit awal sebelum pakai app" atau hibah tanpa modal diakui) — INDEPENDEN dari `price_per_unit` (wajib `>0` untuk cost basis, keputusan lama tidak berubah). Form transaksi utama (`transactionSchema.amount`) sejak awal `positive()` secara GLOBAL — pekerjaan sesi 1 tidak mengadopsi pengecualian ini.

**Fix**: `transactionSchema.amount` → `nonnegative()`. Validasi "wajib >0 untuk kasus LAIN" dipindah ke `validateAllFields`/`errorFieldFor` (`use-transaction-form.ts`), dengan pengecualian `needsInvestmentDirectBuyFields` — ditempatkan di situ (bukan Zod schema) karena butuh akses tipe akun yang cuma tersedia di level hook form.

**Diverifikasi TERUJI runtime** — "Test Tanpa Income" (amount=0) vs "Test Dengan Income" (amount=100.000), akun & `price_per_unit` sama persis: dicek lewat JOIN database, `amount=0` TERBUKTI tidak menambah `accounts.balance` sama sekali, SEDANGKAN `unit`/`price_per_unit` keduanya tetap ikut masuk `average_cost_per_unit` gabungan. Pemisahan amount (modal diakui, opsional) vs price_per_unit (fakta harga pasar, wajib) terbukti bekerja benar.

**Klarifikasi penting dari dogfooding ini**: `price_per_unit=0` BUKAN valid untuk kasus apa pun (termasuk hibah saham) — user sempat menguji ini ("Test Hibah Saham", isi 0, ditolak). Pesan error lama "Harga per unit wajib diisi" menyesatkan kalau user sudah isi 0 (bukan kosong) — diperbaiki jadi 2 pesan terpisah berdasarkan `null` vs `<=0`. Deskripsi baru juga ditambahkan di `field-investment.tsx` untuk kondisi `isDirectBuy`.

### 3. Transfer `debt-debt` — perilaku dikonfirmasi by design, gap UX ditemukan & diperbaiki

User mencoba transfer debtA→debtB ("Test Debt-debt"), dicek: TIDAK ada baris `debts`/`debt_payments` baru. Dikonfirmasi BUKAN bug — `applyDebtTransaction` (`create.ts` baris 54) eksplisit `return none` untuk `pairKind === "debt-debt"`. Rasional (dari diskusi): piutang/utang melekat ke KONTAK (`debts.contact_id`, satu baris satu kontak), bukan ke akun — transfer antar 2 akun debt tidak punya cara sahih menentukan kontak mana di tiap sisi. Murni relokasi saldo akun, sama seperti cash↔cash.

**Gap UX ditemukan**: field "Nama Kontak" tetap WAJIB diisi untuk `debt-debt` sebelum fix (`involvesDebtAccount` tidak membedakan `pairKind`), padahal nilainya tidak pernah dipakai. **Diperbaiki**: `isDebtDebtTransfer` ditambahkan di `use-transaction-debt-fields.ts`, DIKECUALIKAN dari `involvesDebtAccount`, DAN dipakai `FieldContactName` untuk men-disable combobox-nya sepenuhnya (pola sama `debtFieldsLocked`) — field dinonaktifkan karena tidak relevan, bukan sekadar opsional. Detail lengkap (termasuk catatan tepi: `contact_name` yang sempat terisi sebelum akun diganti ke `debt-debt` tetap tersimpan ke `transactions.contact_id`, cuma efeknya nongol di `TransactionDetailDialog`) dicatat di `features/transactions/form/add-edit/README.md`.

### 4. Bug "ganti pasangan akun lintas domain" (2026-10-14) — scope ternyata JAUH lebih luas, DIPERBAIKI di desktop DAN Worker

Dipicu pertanyaan user: "Test Debt-debt diedit ke kombinasi lain, bermasalah tidak?" — ditelusuri ulang root cause bug lama yang sebelumnya dicatat scope-nya cuma "investment↔debt" (lihat [docs/dogfooding/2026-10-14-transfer-ganti-pasangan-akun-silang-investment-debt-sisakan-baris-yatim.md](../../dogfooding/2026-10-14-transfer-ganti-pasangan-akun-silang-investment-debt-sisakan-baris-yatim.md)).

**Scope sebenarnya (ditemukan sesi ini)**: SEMUA orkestrator edit (`update-transaction/{income,expense,transfer}/index.ts`) memilih cabang domain murni dari TIPE AKUN BARU, tidak pernah tahu domain LAMA — berlaku juga untuk income/expense direct, BUKAN cuma transfer. Juga ditemukan gap SIMETRIS di dalam domain investment sendiri: `applyInvestmentTransactionEdit` cuma cek `investment_purchases`, `applySellInvestmentTransactionEdit` cuma cek `investment_sales` — edit yang berpindah arah BELI↔JUAL juga menyisakan baris yatim di tabel lawannya.

**Proses desain solusi (penting untuk dipahami, bukan cuma hasil akhir)** — tiga iterasi sebelum landing di versi final:
1. Percobaan pertama: cleanup berbasis `pairKind` di dalam `update-transaction/transfer/`, cuma menutup jalur transfer — user menunjukkan income/expense ganti akun juga rawan bug sama, iterasi dibuang.
2. Percobaan kedua: cleanup "full, tanpa syarat apa pun" sesuai permintaan awal user — ditemukan SENDIRI lewat analisis baca kode `applyDebtTransactionEdit`: kalau cleanup hapus baris `debts` duluan SEBELUM `applyDebtTransactionEdit` dipanggil, proteksi `DebtEditBlockedError`/`hasPayments` TIDAK AKAN sempat ter-throw (barisnya sudah hilang duluan) — piutang yang sudah dicicil orang lain bisa hilang jejaknya tanpa diblokir. User mengonfirmasi perlu syarat pembeda.
3. **Versi final (disepakati)**: dua syarat berurutan — (a) skip total kalau `account_id`/`transfer_account_id` SAMA SEKALI tidak berubah (shortcut murah, tanpa query tipe akun); (b) KALAU akun berubah, baru cek tipe akun lama vs baru — cleanup HANYA jalan kalau keterlibatan debt/investment BENAR-BENAR hilang (lama involves, baru sama sekali tidak) — kasus ganti akun DALAM domain yang sama (mis. debtA→debtB) tetap diserahkan ke `applyDebtTransactionEdit` sendiri.

**Implementasi desktop**: `update-transaction/cleanup-stale-domain.ts` (baru), dipanggil SEKALI dari `update-transaction/index.ts` SEBELUM percabangan `type`. Reuse fungsi detach generic yang sudah ada (`detachDebtForDeletedTransaction`/`detachInvestmentPurchaseForDeletedTransaction`/`detachInvestmentSaleForDeletedTransaction`, pola sama `use-delete-transaction.ts`) — masing-masing aman no-op kalau tidak ada jejak.

**Implementasi Worker**: gap SAMA ditemukan di `apps/worker/src/modules/transactions/service.ts` (`updateTransactionRow`) — TAPI relevan HANYA untuk `syncSource !== 'pc'` (transaksi dari MCP; transaksi PC sudah aman lewat fix desktop, Worker sengaja tidak ikut campur untuk `syncSource === 'pc'`, lihat komentar existing). `cleanup-stale-domain.ts` versi Worker (`modules/transactions/`) — logic identik, bedanya soft-delete (`deleted_at`) bukan hard-delete. `getAccountType` (sebelumnya duplikat privat identik di `debts/service.ts` DAN `investments/service.ts`) di-export dari `debts/service.ts` supaya reusable.

**Diverifikasi TERUJI runtime (desktop, PARSIAL)**: "Test Debt-debt" (debtA→debtB) diedit jadi "Debt-debt -> cash-debt" (cash→Piutang Dagang) — baris `debts` baru lahir benar, TIDAK ada baris yatim (karena debt-debt memang tidak pernah punya jejak), `cloud_sync_queue` bersih.

**BELUM diuji**: kasus yang PERSIS jadi bug asli (cash→investment diedit jadi cash→debt, membuktikan `investment_purchases` lama benar-benar terhapus — ini skenario paling krusial untuk dibuktikan, belum dicoba sama sekali pasca-fix), kasus investment buy↔sell (gap simetris baru), dan Worker/MCP SAMA SEKALI belum diuji manual (panggil `update_transaction` via MCP, cek D1 langsung).

## Status kode saat ini

- **Desktop**: `shared/debts/new-debt-form/{schema,use-create-debt,new-debt-form}` dan `shared/investments/new-purchase-form/{schema,use-create-investment-purchase,new-investment-purchase-form}` — mode direct dihapus. `features/transactions/form/add-edit/schema/schema.ts` (`amount` nonnegative), `hooks/use-transaction-form.ts` (validasi amount dipindah + `isDebtDebtTransfer` ditambahkan ke return), `hooks/use-transaction-debt-fields.ts` (`isDebtDebtTransfer`, `involvesDebtAccount` dikecualikan), `components/fields/field-contact-name.tsx` (disable + keterangan debt-debt), `components/fields/field-investment.tsx` (deskripsi isDirectBuy), `hooks/use-transaction-investment-fields.ts` (pesan error price_per_unit diperbaiki). **BARU**: `hooks/update-transaction/cleanup-stale-domain.ts`, di-wire dari `hooks/update-transaction/index.ts`.
- **Worker**: `src/modules/debts/service.ts` (`getAccountType` di-export). **BARU**: `src/modules/transactions/cleanup-stale-domain.ts`, di-wire dari `src/modules/transactions/service.ts` (`updateTransactionRow`, di dalam blok `syncSource !== 'pc'`).
- **README** `apps/desktop/src/features/transactions/form/add-edit/README.md` — section baru "Transfer `debt-debt` sengaja tanpa efek ke `debts`/`debt_payments`".
- **Dokumen plan** `apps/desktop/docs/todos/plan/unify-direct-writeoff-into-main-transaction-form.md` — checklist "Nasib dialog/form lama" semua `[x]`, checklist bug "ganti pasangan akun" di Jalur Update jadi `[x]` (DIPERBAIKI), 4 paragraf naratif baru mencakup semua poin di atas.
- `tsc --noEmit` bersih di KEDUA app (desktop & worker). 246 test vitest desktop lulus. Worker TIDAK punya test file sama sekali (`npx vitest run` exit "No test files found") — verifikasi Worker murni dari `tsc` + baca kode manual.
- TIDAK ada commit sepanjang sesi ini — semua di working tree.

## Gap yang TERSISA untuk sesi berikutnya

1. **PALING PENTING — uji ulang kasus asli bug "ganti pasangan akun"** di desktop pasca-fix: transfer cash→investment (bikin `investment_purchases`), lalu edit transaksi YANG SAMA jadi cash→debt (ganti akun tujuan ke debt) — verifikasi `investment_purchases` lama BENAR-BENAR terhapus (bukan cuma dugaan dari baca kode). Ini skenario PERSIS yang pertama kali menemukan bug 2026-10-14, paling kritis untuk dibuktikan.
2. **Uji kasus investment buy↔sell** (gap simetris yang baru ditemukan sesi ini, belum pernah dicoba sama sekali) — transaksi cash→investment (beli) diedit jadi investment→cash (jual), atau sebaliknya, pastikan tidak ada baris `investment_purchases`/`investment_sales` yatim.
3. **Worker/MCP sama sekali belum diuji manual** — panggil `update_transaction` lewat MCP (atau simulasikan payload serupa), ganti pasangan akun lintas domain, cek langsung ke D1 (`wrangler dev` + query D1 lokal) apakah baris lama ter-soft-delete dengan benar.
4. **Edit field berbahaya (recreate/blokir) untuk transaksi direct debt/investment** — masih belum dicoba manual (gap lama dari sesi 1, belum tersentuh sesi ini juga).
5. **Checklist "Jalur Update" di dokumen plan masih punya beberapa kombinasi kosong**: transfer cash↔cash, debt→cash (settlement FIFO), debt→debt (murni ganti field tanpa ganti domain), investment→cash (jual) — belum pernah diuji via Update.
6. **Belum commit** — semua perubahan sesi 1 dan sesi 2 masih di working tree, perlu di-review dan di-commit (kemungkinan dipecah beberapa commit logis: hapus dialog lama, gap amount=0, debt-debt UX, fix cleanup domain).

## Catatan proses (feedback untuk sesi berikutnya)

- **Dogfooding manual TERBUKTI menemukan hal yang baca-kode-saja terlewat** — pola yang SAMA dari sesi 1 (feedback "disiplin dogfooding menemukan bug race condition & push hilang") berulang di sesi ini: pertanyaan user yang mengetes skenario "hibah saham" dan "debt-debt" keduanya mengarah ke temuan nyata (gap amount=0, gap UX kontak, dan akhirnya bug cleanup domain yang scope-nya jauh lebih luas dari dugaan). **Pertahankan**: jangan anggap "sudah dicek lewat baca kode" itu final — ajak user coba skenario konkret di `tauri dev`, terutama untuk interaksi antar-fitur yang baru digabung.
- **Iterasi desain "cleanup-stale-domain" berjalan 3 putaran sebelum solid** — user TIDAK langsung menerima rancangan pertama (berbasis pairKind, scope sempit) maupun kedua (full cleanup tanpa syarat, ditemukan sendiri lewat analisis bahwa itu merusak proteksi `DebtEditBlockedError`). **Pola yang efektif**: setiap kali user menunjukkan ketidaksesuaian ("agak berbeda dengan gambaran saya"), BERHENTI dan verifikasi ulang asumsi lewat baca kode konkret (bukan brainstorming abstrak) sebelum menulis ulang — dua kali iterasi di sesi ini SELALU dimulai dari membaca fungsi target yang relevan (`applyDebtTransactionEdit`, `updateIncomeTransaction`) untuk membuktikan klaim, bukan menduga.
- **User eksplisit minta "Jangan wire dlu sebelum saya cek"** di tengah proses menulis cleanup — dihormati, kode ditulis/direvisi beberapa kali TANPA di-wire sampai user eksplisit bilang "lanjut wire". Pola ini berharga untuk pekerjaan yang menyentuh logic berisiko tinggi (silent data loss) — pisahkan "menulis fungsi" dari "mengaktifkannya", beri user kesempatan review di antara keduanya.
- **Komentar kode**: user secara eksplisit minta komentar panjang DIHAPUS, diganti JSDoc ringkas (1 kalimat ringkasan + `@param` per parameter + `@returns`) — BUKAN paragraf rasional panjang gaya sesi-sesi sebelumnya. Ini kemungkinan preferensi BARU yang perlu dikonfirmasi lagi kalau ambigu di sesi depan (beda dari pola "semua komentar ke README" yang disebutkan sesi 1 — kali ini user minta dihapus total, bukan dipindah).
- **Dokumen plan terus diupdate checklist+paragraf naratif tiap topik selesai** — pola yang sama dari sesi 1, dipertahankan konsisten sepanjang sesi ini (4 update terpisah: dialog lama, gap amount=0+debt-debt, dan bug cleanup domain).
