# Handover — 2026-09-29 (sesi 2)

Lanjutan dari `2026-09-29-1-pelunasan-ar-ap-4-sourcetype-dan-riset-consignment.md`.
Sesi ini menyelesaikan 2 dari 4 gap "TERSISA" yang dicatat di akhir
sesi 1 — **detail teknis lengkap ada di dokumen plan
`docs/todos/plan/retailku-ar-ap-negative-amount-settlement.md`, BACA
ITU dulu sebelum lanjut apa pun terkait AR/AP** — dokumen ini cuma
ringkasan alur sesi, checklist lengkap (kode/query yang diubah, cara
verifikasi, keputusan yang dikonfirmasi user, temuan riset data nyata)
ada di sana.

## Ringkasan hasil sesi

Awal sesi: `debt_payments.account_id` NULL sengaja untuk SEMUA baris
pelunasan (gap #1 sesi 1), dan `cashAccounts` pada piutang/utang BARU
diabaikan total (gap lama sesi 2026-09-28-3, "DP/split payment"). Akhir
sesi: **kedua gap ini SELESAI** — akun kas sekarang terisi untuk kedua
kasus, dengan scope yang disederhanakan setelah riset data nyata
membuktikan pola yang lebih rumit (split kas, kas keluar/talangan,
campuran PPOB) tidak pernah/jarang terjadi di data Warung Aqil.

## Urutan pengerjaan

1. **Representasi kas dari pelunasan** (gap #1 sesi 1) — helper
   `resolveArApCashAccounts` (sudah ada dari sesi sebelumnya, TIDAK
   PERNAH dipanggil) sekarang disambungkan. Riset data nyata (26 baris
   pelunasan) membuktikan split kas ke >1 akun TIDAK PERNAH terjadi —
   scope disederhanakan jadi "cuma 1 akun kas". Helper baru
   `resolvePaymentAccountId`, field baru `ArApSyncPlanRow.paymentAccountId`.
   `insertArApPayment`/`insertArApPaymentsBatch` sekarang isi
   `account_id` dari situ (bukan literal `NULL` lagi).
2. **Representasi kas dari DP/split payment** (gap lama sesi
   2026-09-28-3) — user eksplisit minta "handle" setelah ditanya
   apakah ini terkait dengan gap #1. Riset data nyata (73 baris
   piutang/utang baru) menemukan `cashAccounts` pada piutang BARU
   punya 3 pola berbeda (DP SALE murni 41%; LEDGER_ENTRY non-trade
   dengan kas KELUAR/talangan, bukan DP; SALE campuran artefak payout
   PPOB) — scope dipersempit ke pola DP murni saja (dikonfirmasi user
   lewat AskUserQuestion 2×: scope pola, dan bentuk representasi).
   Helper baru `resolveDownPayment`, field baru
   `ArApSyncPlanRow.downPayment`, diinsert sebagai baris `transactions`
   BIASA (bukan `debt_payments` — dibuktikan lewat contoh nyata DP >
   sisa piutang, opsi `debt_payments` ditolak user karena tidak masuk
   akal secara akuntansi). Helper baru `insertArApDownPayment`.
3. **Perbaikan layout preview UI** — badge baru "+DP" sempat bikin
   tabel preview perlu scroll horizontal (screenshot user). Diperbaiki:
   `TableCell` kolom Status jadi `whitespace-normal` (override default
   `whitespace-nowrap` di komponen `Table`), dialog dilebarkan
   `max-w-2xl` → `max-w-3xl`. Diverifikasi VISUAL oleh user di
   `tauri dev` (2 screenshot before/after) — sudah rapi, tidak perlu
   scroll horizontal lagi.

## Verifikasi hasil kerja sesi ini

1. **`npx tsc --noEmit`** — bersih di setiap iterasi.
2. **`npx vitest run`** — 153/153 lulus (naik dari 129 baseline awal
   sesi — 24 test baru total across kedua gap).
3. **`cargo check`** — sukses, TIDAK ada migrasi baru (kedua gap reuse
   kolom/tabel yang sudah ada: `debt_payments.account_id` dari migrasi
   0026, tabel `transactions` yang sudah ada).
4. **Verifikasi VISUAL di `tauri dev`** (USER langsung, rentang
   2026-09-01 s/d 2026-09-28, Warung Aqil) — summary stat "DP akan
   tercatat: 12" dan badge "+DP" tampil benar di baris-baris
   "Hutang ke Penitip / Mba-mba Kado Kuning" (piutang baru dengan DP),
   TIDAK muncul di baris pelunasan atau piutang tanpa DP — sesuai
   ekspektasi.
5. **BELUM** diverifikasi end-to-end untuk cabang "ketemu" (baris
   `paymentAccountId`/`downPayment` benar-benar terisi non-null dari
   data live) — rentang data yang dicek user semua piutang aslinya
   belum pernah ter-INSERT sungguhan (masih DRY_RUN), jadi cabang itu
   cuma tervalidasi lewat unit test, SAMA seperti gap-gap sebelumnya.

## Status kode saat ini (PENTING, baca sebelum lanjut apa pun)

- **Masih `DRY_RUN = true`** di `sync-cashflow.ts` — SAMA seperti
  sesi-sesi sebelumnya, insert sungguhan belum pernah dicoba.
- **Kedua gap sesi ini HANYA tervalidasi lewat unit test** untuk
  cabang "ketemu" (akun kas terisi) — data dev real belum bisa memicu
  cabang itu (lihat poin 5 di atas).
- Semua keputusan scope sesi ini (pola mana yang ditangani, pola mana
  yang diabaikan) **berbasis riset data nyata**, bukan asumsi — detail
  angka pasti (jumlah baris per pola, contoh konkret) ada di dokumen
  plan.

## Gap yang TERSISA untuk sesi berikutnya (checklist lengkap di
dokumen plan)

1. `account_type: advance` — masih rencana dokumen terpisah
   (`docs/todos/plan/account-type.md`), tidak terkait langsung.
2. DRY_RUN belum dinonaktifkan — SEMUA gap AR/AP (termasuk yang
   sudah "selesai" secara kode) baru actionable end-to-end setelah
   keputusan eksplisit user mengaktifkan insert sungguhan, DAN setelah
   ada cara nyata menguji cabang "ketemu" (butuh piutang yang
   BENAR-BENAR sudah tersinkron via `retailku_sync` di database dev).
3. Pola-pola `cashAccounts` yang SENGAJA diabaikan (bukan lupa) —
   kalau nanti dibutuhkan: split kas >1 akun pada pelunasan (belum
   pernah terjadi di data), kas keluar/talangan LEDGER_ENTRY non-trade
   (7 baris di data, POLA BERBEDA — bukan DP), campuran payout PPOB
   (2 baris, tumpang tindih modul PPOB). Detail lengkap tiap pola ada
   di dokumen plan, JANGAN diasumsikan ulang tanpa baca riset yang
   sudah ada.

## Catatan proses (feedback untuk sesi berikutnya)

- **User eksplisit minta 2 pertanyaan desain dijawab via
  AskUserQuestion sebelum coding**, bukan diasumsikan — pola scope
  (cuma pola A, bukan pola B/C) dan bentuk representasi (transactions
  biasa, bukan debt_payments) keduanya dikonfirmasi eksplisit.
  **Pelajaran: kalau data nyata menunjukkan pola lebih kompleks dari
  yang direncanakan sebelum riset, JANGAN putuskan scope sendiri —
  sodorkan pilihan konkret ke user**, terutama kalau salah satu opsi
  punya implikasi akuntansi yang tidak masuk akal (dibuktikan lewat
  contoh, bukan cuma diklaim).
- **Riset data nyata via agent SEBELUM desain, bukan sesudah** —
  pola sesi-sesi sebelumnya berlanjut: 2 investigasi agent terpisah
  dilakukan sebelum menulis kode sama sekali sesi ini (satu untuk
  gap kas pelunasan, dua untuk gap DP — termasuk 1 investigasi
  lanjutan setelah temuan awal menunjukkan pola aneh "cashAccounts
  negatif" yang ternyata bukan bug, tapi transaksi ekonomi berbeda).
  **Pelajaran: temuan data yang mengejutkan (angka tidak sesuai
  hipotesis awal) butuh 1 putaran investigasi LAGI untuk pahami akar
  penyebabnya sebelum didesain sekitarnya** — jangan langsung
  asumsikan itu noise/bug.
- **User memverifikasi visual dengan screenshot, menangkap regresi
  UI (scroll horizontal) yang tidak akan ketahuan dari tsc/vitest** —
  konsisten dengan feedback sesi-sesi sebelumnya soal pentingnya
  verifikasi end-to-end. Perbaikan layout (`whitespace-normal` +
  lebar dialog) tidak butuh riset data, cuma perlu screenshot user
  untuk ketahuan.
- User TIDAK ingin agen menjalankan `tauri dev`/restart server
  sendiri — pola ini konsisten dari sesi-sesi sebelumnya.
