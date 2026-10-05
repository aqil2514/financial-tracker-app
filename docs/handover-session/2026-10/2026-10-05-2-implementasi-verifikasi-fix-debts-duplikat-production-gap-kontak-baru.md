# Handover — 2026-10-05 (sesi 2)

Lanjutan sesi 1 ([2026-10-05-1-investigasi-debts-duplikat-rencana-fix-source-based-ownership.md](2026-10-05-1-investigasi-debts-duplikat-rencana-fix-source-based-ownership.md)):
3 dokumen rencana sudah disiapkan sesi lalu, sesi ini IMPLEMENTASI
penuh (Worker + desktop) + DEPLOY + VERIFIKASI langsung di production
lewat dogfooding (bukan simulasi) — ketemu & tutup 1 gap desain
tambahan di tengah jalan, PLUS 3 gap lain yang TERPISAH (bukan bagian
fix ini) yang ketahuan justru karena verifikasi dilakukan sungguhan
di data production, bukan cuma `wrangler dev`.

## Ringkasan hasil sesi (kronologis)

### 1. Implementasi Worker (SELESAI, sesuai rencana sesi 1)

- `transactions/service.ts`: syarat `syncSource !== 'pc'` sebelum
  `applyDebtTransaction` (create) dan sebelum bagian TULIS edit
  (update).
- `debts/service.ts`: split `applyDebtTransactionEdit` lama jadi 2
  fungsi — `checkDebtEditAllowed` (precheck read-only, UNCONDITIONAL
  semua `syncSource`) + `applyDebtEditAction` (bagian tulis,
  dikondisikan `syncSource !== 'pc'`). Sesuai keputusan user di sesi
  1 ("split fungsi", bukan "wrap existing call").
- Fungsi baru `pushDebtFromPc`/`pushDebtPaymentFromPc` (upsert-by-id
  MURNI, termasuk provenance `source`/`sourceRef` — detail ini
  ditambahkan belakangan, awalnya kelupaan di draft pertama, dikoreksi
  setelah baca ulang catatan rencana sesi 1 yang eksplisit minta
  `source`/`sourceRef` JANGAN di-drop).
- Endpoint baru `POST /debts/push`, `POST /debts/payments/push`
  (bukan `/debt-payments/push` seperti draft awal — disesuaikan krn
  tidak ada router `debt-payments` terpisah).
- Type-check lolos, verifikasi route matching Hono manual (script
  Node ad-hoc) pastikan tidak bentrok dgn route `/:id/payments` dkk.

### 2. Implementasi desktop (SELESAI, sesuai rencana sesi 1)

- Migrasi `0034_cloud_sync_queue_debts.sql` (rebuild CHECK constraint
  `cloud_sync_queue.table_name`, tambah `'debts'`/`'debt_payments'`)
  + registrasi `migrations.rs` versi 34.
- `QueueableTable` tambah 2 literal, `push-row.ts`/`worker-client.ts`
  tambah case/fungsi baru (termasuk `source`/`sourceRef`).
- `apply-debt-transaction.ts`: `applyDebtTransaction`/
  `applyDebtTransactionEdit`/`settleDebtsFifo` diubah return
  `TouchedDebtRows` (`{debtIds, debtPaymentIds}` awalnya, diperluas
  jadi 4 field — lihat poin 3) bukan lagi `void` — user pilih opsi
  "array lengkap" (bukan "cuma id baru") saat ditanya via
  `AskUserQuestion`, supaya baris yang CUMA status-nya berubah
  (mis. `debts.status` jadi `'paid'`) ikut dipush ulang juga.
- `pushOnWrite` dipasang di 5 titik (daftar lengkap persis di dokumen
  `done/fix-debts-duplikasi-sync.md` app desktop).
- Rust test (3/3) + TS test (172/172, termasuk
  `apply-debt-transaction.test.ts` yang return value-nya berubah
  bentuk) lolos.

### 3. Gap ditemukan DI TENGAH test manual: endpoint DELETE

Saat test manual `wrangler dev` (edit nominal transaksi test 2x
berturut), baris `debts` MENUMPUK bukan ter-replace. Root cause:
`/debts/push` cuma upsert-by-id, tidak pernah tahu id LAMA harus
dihapus saat desktop RECREATE (edit field berbahaya: hapus lokal,
insert baru dgn id beda). **User pilih opsi "tambah push delete"**
(bukan "desktop pertahankan id lama") saat ditanya.

Fix: endpoint `DELETE /debts/push/:id` + `DELETE /debts/payments/push/:id`
baru di Worker (soft-delete murni, `deletePushedDebt`/
`deletePushedDebtPayment`), `TouchedDebtRows` diperluas
`deletedDebtIds`/`deletedDebtPaymentIds`, `pushDeleteOnWrite` dipasang
di 2 titik (`use-update-transaction.ts`, `use-edit-payment.ts` —
satu-satunya 2 pemanggil `applyDebtTransactionEdit`). Diverifikasi
ulang via `wrangler dev`: edit berulang, net pertambahan baris AKTIF
per edit = 0.

Dokumen Worker + desktop di-update mencatat gap ini sbg bagian resmi
dari fix (bukan sbg item terpisah) — checklist diupdate `[x]` semua.

### 4. Deploy production + verifikasi via dogfooding sungguhan

User deploy Worker (`wrangler deploy`) + build ulang desktop sendiri
(di luar sesi ini — hanya dikonfirmasi selesai). Lanjut verifikasi
LANGSUNG di data production (bukan `wrangler dev` lagi):

1. Diminta cek duplikat production dulu (`wrangler d1 execute
   --remote`) — D1 SELALU bersih (0 duplikat), konsisten temuan sesi
   1. Duplikat cuma di `finance.db` lokal: Mama Dicky (2), Kak Ipit
   (3), Wahyu (2) — 7 baris aktif, seharusnya 3.
2. User putuskan: **hapus total** (transaksi + `debts` turunan, dicek
   dulu TIDAK ada `debt_payments` terkait) dari KEDUA sisi (lokal +
   D1 production), lalu INPUT ULANG manual via UI — bukan sekadar
   hapus baris `debts` duplikat sisakan 1 (opsi lain yang ditawarkan,
   ditolak user krn "sekalian jadi test end-to-end form transaksi").
   Backup `.bak` dibuat sebelum tiap operasi destruktif.
3. Mama Dicky & Kak Ipit: input ulang sukses LANGSUNG, 1 baris `debts`
   di D1, terverifikasi query langsung. Kak Ipit sempat salah note
   ("Kak Ipit" bukan "Nalangin Paylater") — diedit lagi, push note
   update SUKSES (bukti jalur edit non-dangerous-field bekerja).
4. Wahyu: BERMASALAH BERULANG — transaksi tidak pernah sampai ke D1
   meski toast sukses. Investigasi panjang (lihat gap #5/#6/#7 di
   bawah) sebelum akhirnya berhasil.

### 5. Gap TERPISAH #1: `resolveContactId` desktop tidak push kontak baru

Root cause akhir kenapa Wahyu gagal terus: kontak "Wahyu" (dibuat
lewat `resolveContactId` di form transaksi) **tidak pernah ter-push
ke Worker** — fungsi itu cuma INSERT lokal, tidak ada
`pushOnWrite("contacts", id)` sama sekali. Transaksi yang merujuk
kontak ini SELALU ditolak 422 ("Kontak belum ditemukan di cloud").

Efek berantai: krn kontak PC tidak pernah ter-push, Worker (dari
jalur lain, kemungkinan MCP) auto-create VERSI KEDUA kontak "Wahyu"
dgn id berbeda → 2 baris kontak nama identik di database.

**Workaround sesi ini** (BUKAN fix kode): kontak "Wahyu" asli
di-INSERT manual ke D1 production via `wrangler d1 execute`. Kontak
duplikat (versi Worker, dicek dulu TIDAK dipakai transaksi/debt
manapun) dihapus dari kedua sisi.

### 6. Gap TERPISAH #2: combobox kontak key collision

Ditemukan user lewat screenshot: dropdown "Nama Kontak" di form Edit
menampilkan "Wahyu" berulang-ulang (2-3x, tidak konsisten), bahkan
saat user mengetik nama LAIN ("munan") — field juga sempat ter-clear
sendiri. Root cause: `contact-field.tsx` pakai `contact.name` (bukan
`contact.id`) sbg `value`/key opsi combobox — 2 kontak nama sama
(gap #5) = key collision React klasik.

**Workaround sesi ini**: setelah dedup kontak (gap #5), combobox
kembali normal. Kode `ContactField` SENDIRI tidak diubah (masih pakai
`name` sbg key) — berpotensi berulang kalau ada kontak nama sama
lain muncul lagi.

### 7. Gap TERPISAH #3: 422 rejected tidak pernah retry otomatis

Bukan kode baru, tapi dampaknya baru kelihatan nyata sesi ini:
`push-on-write.ts` sengaja TIDAK meng-enqueue push yang di-reject
(422) ke antrian retry — assumsinya "data lokal valid, payload sama
akan ditolak lagi". Tapi utk 422 yang disebabkan STATE SEMENTARA
(dependency belum sinkron, bukan data salah permanen), transaksi itu
SELAMANYA tidak pulih kecuali ADA trigger submit baru manual (edit &
simpan ulang) — dan tidak ada indikator UI sama sekali yang
memberitahu user baris ini gagal sync.

User perlu diminta edit-simpan-ulang Wahyu BEBERAPA KALI (setelah
kontak diperbaiki, setelah dedup kontak) sebelum akhirnya transaksi +
`debts`-nya berhasil masuk D1 — karena tiap percobaan push SEBELUM
dependency-nya benar juga gagal 422/500 silent dan harus di-retrigger
manual lagi.

### 8. Wahyu akhirnya berhasil, lengkap dgn edit field berbahaya

Setelah kontak di-dedup + diinsert manual ke D1: transaksi test
("test", Rp12.312) berhasil push setelah 2x retry manual (push
`transactions` dan `debts` race, debts sempat gagal FK duluan sebelum
`transactions` sukses — resolve sendiri di retry kedua). User lalu
EDIT transaksi ini jadi data final (Rp124.537, "Nalangin Paylater",
04 Okt 2026 14:01) — **membuktikan jalur recreate+DELETE (gap #3) jalan
benar di production sungguhan**: baris lama `deleted_at` terisi, baris
baru aktif, net 1 baris.

### 9. Dokumentasi — dogfooding doc, release notes, reorganisasi todos

- Dogfooding doc baru:
  [`docs/dogfooding/2026-10-05-verifikasi-fix-debts-duplikat-dan-gap-kontak.md`](../../dogfooding/2026-10-05-verifikasi-fix-debts-duplikat-dan-gap-kontak.md) —
  hasil verifikasi fix (BERHASIL) + 3 gap terpisah (poin 5/6/7 di
  atas) secara detail.
- `docs/release/v0.1.4.md` — section "Perbaikan" baru (bahasa
  user-facing, tidak sebut 3 gap terpisah krn belum diperbaiki).
- User eksplisit minta: **buat dokumen rencana terpisah** utk gap
  "shortcut `/debts` tidak push `transactions`" (sudah disebut di
  rencana sesi 1 sbg "gap terpisah, belum ada dokumen sendiri") —
  dibuat [`docs/todos/plan/fix-debts-shortcut-tidak-tersync.md`](../../todos/plan/fix-debts-shortcut-tidak-tersync.md).
  **Catatan**: 3 gap kontak (poin 5/6/7) BELUM dibuatkan dokumen
  rencana sendiri — cuma tercatat di dogfooding doc, bukan todo aktif.
- 3 dokumen fix duplikasi (index root + Worker + desktop) DIPINDAH
  `plan/` → `done/` (checklist semua `[x]`, termasuk "Pembersihan
  data" yang diupdate detail hasil akhir). SEMUA link relatif
  antar-dokumen + dari dogfooding doc diperbaiki — sekalian ketemu
  bug LAMA (link `../../../` kurang 1 level sejak draft sesi 1,
  sebelumnya broken tapi belum pernah ketahuan krn belum pernah
  diklik/dicek).

## Status kode & data saat ini

- **Kode**: SEMUA perubahan sesi 1+2 (Worker + desktop) sudah di-commit
  user (`git log` — commit "Fix penemuan dogfooding"), SUDAH di-deploy
  Worker production + build ulang desktop production (dilakukan user
  sendiri, di luar sesi).
- **Data production**: 3 transaksi (Mama Dicky, Kak Ipit, Wahyu) sudah
  bersih — masing-masing TEPAT 1 baris `debts` aktif, diverifikasi
  `wrangler d1 execute --remote` langsung. Kontak "Wahyu" sudah
  di-dedup (1 baris, bukan 2).
- **Backup**: beberapa `.bak_<timestamp>_...` dibuat di
  `%APPDATA%\com.windows.financial-app\` sebelum tiap operasi
  destruktif (hapus transaksi duplikat, hapus kontak duplikat) — BELUM
  dibersihkan, biarkan menumpuk sesuai kebiasaan project (lihat file
  `.bak` lama lain yang sudah ada di folder itu).
- **Dokumentasi**: belum di-commit (semua perubahan poin 9 di atas
  dilakukan SETELAH user commit kode) — lihat Gap yang tersisa.

## Gap yang TERSISA untuk sesi berikutnya

1. **Commit dokumentasi sesi ini** — dogfooding doc baru, release
   notes update, dokumen pindah plan→done (3 file + reference fix di
   4 file lain), dokumen rencana baru (`fix-debts-shortcut-tidak-tersync.md`).
   BELUM di-commit, belum ditanya ke user.
2. **`fix-debts-shortcut-tidak-tersync.md`** (dokumen baru) — BELUM
   diimplementasikan sama sekali, baru draft rencana. Fix-nya relatif
   simpel (tambah `pushOnWrite("transactions", ...)` di
   `use-create-debt.ts` 2 titik + `use-pay-debt.ts` 3 cabang, Worker
   TIDAK perlu endpoint baru) tapi belum dikerjakan.
3. **3 gap kontak** (resolveContactId tidak push, combobox key
   collision, 422 tidak retry) — BELUM ada dokumen rencana sendiri,
   cuma tercatat di dogfooding doc. User belum diajak diskusi prioritas
   mana yang mau dikerjakan duluan atau sekaligus.
4. **Data kotor sisa testing** di D1 LOKAL (`wrangler dev`, environment
   test terpisah) — disebut di dokumen Worker, TIDAK perlu dibersihkan
   serius (bukan production).

## Catatan proses (feedback utk sesi berikutnya)

- **User menguji APA YANG DIKATAKAN "sudah selesai" dgn sangat teliti**
  — pola kuat berulang: tiap kali saya bilang "fix sudah diverifikasi"
  (test unit, `wrangler dev`), user selalu minta bukti lebih jauh
  (production sungguhan, dogfooding langsung) SEBELUM percaya selesai.
  Terbukti BENAR 2x: gap DELETE (poin 3) ketahuan dari test manual yg
  lebih dalam dari rencana awal; 3 gap kontak (poin 5-7) ketahuan HANYA
  krn verifikasi dilakukan di data production asli, BUKAN simulasi.
  Pelajaran: "test lolos" ≠ "selesai" utk perubahan yang menyentuh
  sync/database — dogfooding sungguhan menemukan kelas bug yang sama
  sekali berbeda dari apa yang bisa ditemukan test terisolasi.
- **User koreksi kesimpulan saya BERKALI-KALI lewat observasi detail
  yang saya lewatkan** — contoh konkret: saya sempat salah baca data
  (kira Kak Ipit yang berubah padahal Wahyu belum diedit — dikoreksi
  user "perhatikan lagi, yang nominal Rp 124.537, belum saya edit,
  ingat idnya"), saya sempat salah asumsi soal urutan kejadian edit
  (dikoreksi via screenshot dialog yang BELUM di-submit vs SUDAH).
  Pelajaran: saat membaca output query/screenshot sbg bukti, JANGAN
  buru-buru simpulkan — cross-check ulang id/timestamp/field PERSIS
  sebelum menyatakan sesuatu "terbukti" atau "aneh".
- **User minta izin eksplisit sebelum operasi destruktif** (hapus
  transaksi+debts, hapus kontak duplikat) — selalu dijawab dgn
  `AskUserQuestion` dulu (opsi + alasan), BUKAN langsung eksekusi
  walau analisis sudah meyakinkan. Pola ini konsisten dgn
  [[feedback_backfill_migration_verify_not_assume]] di memory,
  diperluas ke "hapus data production" juga.
- **User secara eksplisit minta dokumen rencana terpisah utk gap yang
  disebut "di luar scope"** — bukan dibiarkan jadi catatan pasif di
  dokumen lain. Pelajaran: kalau riset/dogfooding menemukan gap yang
  jelas-jelas terpisah scope, JANGAN cuma catat sbg bullet point di
  dokumen current — user lebih suka dipecah jadi dokumen `plan/`
  sendiri dari awal (lebih gampang di-track/dikerjakan sesi lain).
- **Instruksi "pindah plan ke done" sekaligus memicu saya menemukan
  bug lama (link relatif salah sejak draft sesi 1)** — tidak pernah
  ketahuan sebelumnya krn tidak pernah benar-benar diklik/divalidasi.
  Pelajaran: setiap kali memindahkan/merename file markdown yang
  saling me-link, SELALU scan ulang SEMUA link (bukan cuma yang
  "kelihatan jelas berubah") — kedalaman path yang salah gampang lolos
  dari baca sekilas.
