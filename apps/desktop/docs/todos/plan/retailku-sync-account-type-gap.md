# Sync Retailku — `debts`/`debt_payments` Tanpa `account_id` (Gap Konsep Tipe Akun)

## Latar belakang

Ditemukan 2026-10-03 saat audit kepatuhan kode terhadap
[docs/concept/konsep-tipe-akun.md](../../../../../docs/concept/konsep-tipe-akun.md)
(lihat
[docs/todos/plan/audit-kepatuhan-konsep-tipe-akun.md](../../../../../docs/todos/plan/audit-kepatuhan-konsep-tipe-akun.md),
temuan #1.2 / pertanyaan #2) — **sengaja DI-SKIP** di sesi solusi
2026-10-03 karena dianggap lebih dalam dari perkiraan awal, dilempar ke
sesi audit tersendiri. Dokumen ini jadi starting point sesi itu.

Prinsip #1 `konsep-tipe-akun.md`: "akun sebagai tumpuan semua data" —
setiap `debts`/`debt_payments` harus menunjuk ke sebuah akun (bertipe
`debt`), bukan NULL. Di sesi 2026-10-03, pelanggaran yang sama untuk
jalur MANUAL ("mode direct") sudah dibereskan — `debts.account_id` kini
wajib akun bertipe `debt` (lihat migrasi
`0031_seed_default_debt_account.sql`). **Jalur Retailku TIDAK ikut
diselaraskan** — ini dokumen gap-nya.

## Gap konkret

Sync Retailku (`apps/desktop/src/features/retailku/**`, SATU ARAH:
tarik data cashflow DARI POS Retailku KE SQLite lokal — fitur ini
sendiri SUDAH matang, lihat `docs/todos/done/retailku-*.md`) sudah
LAMA (sebelum konsep tipe akun dirumuskan) membuat baris `debts`/
`debt_payments` dengan `account_id` NULL:

- `apps/desktop/src/features/retailku/shared/sync/cashflow/helpers/insert-ar-ap-transaction.ts`
  — SELALU insert `debts` dengan `transaction_id: NULL` (piutang/utang
  dagang murni tanpa sisi kas), `account_id` dari hasil mapping yang
  bertipe `string | null`.
- `apps/desktop/src/features/retailku/shared/sync/cashflow/helpers/insert-ar-ap-payment.ts`
  dan `insert-ar-ap-payments-batch.ts` — `debt_payments.account_id`
  bisa NULL "kalau akun kas belum dipetakan atau split ke >1 akun kas"
  (komentar eksplisit di kode).
- `apps/desktop/src-tauri/migrations/0025_debts_source_ref.sql` —
  komentar migrasi MENGONFIRMASI ini sudah jadi desain sadar: "baris
  `debts` hasil sync AR/AP sekarang bisa `transaction_id: NULL`
  (piutang/utang dagang murni tanpa sisi kas)".

Baris-baris ini bisa dibedakan dari data manual lewat kolom
`debts.source = 'retailku_sync'` (vs `'manual'`) — migrasi
`0031_seed_default_debt_account.sql` SENGAJA cuma backfill
`source = 'manual'`, baris Retailku tidak disentuh.

## Kenapa ini lebih dalam dari sekadar "isi account_id-nya"

Beda dari mode direct manual (yang user yang pilih akun debt-nya
sendiri di form), piutang/utang dagang dari Retailku datang dari sistem
eksternal tanpa konteks "akun mana yang dipetakan" secara 1:1 — kadang
split ke >1 akun kas, kadang akun kas belum dipetakan sama sekali
(lihat komentar di `insert-ar-ap-payment.ts`). Pertanyaan yang perlu
dijawab SEBELUM implementasi (bukan di sesi ini):

1. Apakah piutang dagang Retailku butuh akun debt TERPISAH dari akun
   debt manual (misal "Piutang Dagang Retailku" vs "Utang & Piutang"
   default), atau boleh berbagi akun debt yang sama?
2. Untuk kasus "split ke >1 akun kas" — apakah itu jadi alasan sah
   akun debt-nya juga perlu dipecah, atau akun debt tetap SATU (cuma
   sisi kas-nya yang historically dipecah, tidak relevan ke
   `debts.account_id`)?
3. Data LAMA (baris existing dengan `account_id` NULL dari sync
   Retailku) — perlu backfill retroaktif sekaligus, atau cukup
   berlaku ke baris baru ke depan?
4. Apakah guard "akun sebagai tumpuan" (yang sudah ditegakkan di jalur
   manual lewat validasi Worker/MCP) juga perlu ditegakkan di jalur
   sync Retailku — dan kalau iya, di titik mana (saat insert
   `insert-ar-ap-transaction.ts`, atau dibolehkan lolos karena ini
   jalur internal PC yang tidak lewat Worker)?

## Status terkait yang relevan (sudah beres, untuk referensi)

- `docs/todos/plan/audit-kepatuhan-konsep-tipe-akun.md` — 6 dari 7
  temuan tipe akun lain sudah dieksekusi (commit `572ff59`), termasuk
  akun debt default + guard "akun sebagai tumpuan" utk jalur manual.
- `apps/desktop/docs/todos/plan/cloud-sync-retailku-provenance-gap.md`
  — dokumen TERPISAH, soal `source`/`source_ref` tidak ikut ter-sync
  ke cloud (Desktop<->Worker). Concern BEDA dari dokumen ini (yang soal
  `account_id` NULL) — tapi sama-sama di ranah "integrasi Retailku",
  kemungkinan relevan dibaca bareng di sesi audit berikutnya.
