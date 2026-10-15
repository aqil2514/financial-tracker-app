# apply-investment-transaction

Logika pencatatan `investment_purchases` yang dipicu oleh transaksi —
dipecah per concern (create/edit/delete) dari file tunggal
`apply-investment-transaction.ts`, mengikuti pola yang sama dengan
[shared/debts/apply-debt-transaction/](../../debts/apply-debt-transaction/README.md)
(2026-10-15). Semua caller tetap import dari
`@/shared/investments/apply-investment-transaction` (path folder,
resolve ke `index.ts`) — tidak ada caller yang perlu diubah oleh
pemecahan ini.

Lihat juga [docs/concept/konsep-investasi.md](../../../../../docs/concept/konsep-investasi.md)
untuk konsep di baliknya, terutama bagian "Unit dan harga per unit",
"Settlement tertunda", dan "Unit yang berubah TANPA transfer kas".

## types.ts

`TouchedInvestmentRows` — protokol pelaporan yang sama fungsinya dengan
`TouchedDebtRows` di `apply-debt-transaction/types.ts`: memberi tahu
caller baris `investment_purchases` mana yang disentuh (dibuat ATAU
di-UPDATE) dan mana yang di-HARD-DELETE, supaya caller tahu apa yang
perlu di-`pushOnWrite`/`pushDeleteOnWrite` ke Worker.

## create.ts

`applyInvestmentTransaction` — dipanggil SETELAH insert baris
`transactions` selesai (butuh `transactionId` untuk
`investment_purchases.transaction_id`). Setelah transaksi transfer
tersimpan, deteksi apakah transfer ini kas -> akun
`account_type='investment'` dan, kalau ya, buat satu baris
`investment_purchases` (pola sama `applyDebtTransaction` membuat
`debts` dari transfer kas<->debt):

- cash -> investment: satu baris `investment_purchases` baru, status
  default `'pending'` (settlement dikonfirmasi manual belakangan lewat
  edit baris, lihat bagian "Settlement tertunda" di
  `konsep-investasi.md`) — tapi bisa langsung `'settled'` kalau caller
  sudah tahu nilainya pasti saat itu juga (lihat parameter `status`).
- investment -> cash (penjualan/penarikan sebagian): BUKAN urusan
  fungsi ini — no-op (`pairKind !== "cash-investment"`). Ditangani
  fungsi terpisah `applySellInvestmentTransaction`
  (`apply-sell-investment-transaction.ts`) karena model datanya beda
  total (average cost, realized P/L, validasi oversell, efek balance
  non-nominal — lihat `konsep-investasi.md` bagian
  "Penjualan/penarikan sebagian").
- kombinasi lain yang melibatkan investment (investment-debt, dst):
  `classifyAccountPair` sudah throw `UnsupportedAccountPairError` lebih
  dulu (lihat `classify-account-pair.ts`) — BELUM ada model datanya,
  jadi tidak pernah sampai ke sini. Seharusnya sudah dicegat lebih
  dulu oleh validasi form (`use-transaction-investment-fields.ts`),
  guard di sini adalah safety net.

**`unit`/`pricePerUnit` opsional** (keputusan 2026-10-06, revisi dari
wajib): order yang masih diproses (mis. reksadana) sering belum tahu
unit pastinya sampai settlement dikonfirmasi — null berarti "belum
diketahui", diisi belakangan lewat edit baris `investment_purchases`.
`pricePerUnit` independen dari `unit` (TIDAK divalidasi terhadap
nominal transfer) — lihat `use-transaction-investment-fields.ts` +
`konsep-investasi.md` bagian "Unit dan harga per unit".

**`status` default `'pending'`** kalau tidak diisi (form transaksi
utama belum punya switch status, selalu pending dulu). Dialog "Catat
Pembelian" (`new-purchase-form/`) punya switch untuk langsung tandai
`'settled'` kalau unit/harga sudah pasti saat itu juga — keputusan
2026-10-06, lihat `schema.ts` (`superRefine` mewajibkan unit/harga
diisi kalau status `'settled'`).

## edit.ts

`applyInvestmentTransactionEdit` — versi `applyInvestmentTransaction`
untuk jalur EDIT transaksi. Field unit/harga TIDAK divalidasi terhadap
nominal (lihat `konsep-investasi.md`), jadi tidak ada kasus "diblokir"
seperti `DebtEditBlockedError` (tidak ada baris lain yang bergantung
pada satu `investment_purchases`, beda dari `debts` yang bisa sudah
dicicil).

**Revisi 2026-10-08 (bug ditemukan lewat dogfooding)**: baris lama
TIDAK selalu aman di-delete-lalu-recreate lewat
`applyInvestmentTransaction` — fungsi itu `return none` (no-op) untuk
`type !== 'transfer'`, sedangkan baris `investment_purchases` juga
bisa lahir dari jalur `record_mode: 'direct'`
(`createDirectInvestmentPurchase`/`create_investment_purchase_direct`,
transaksi `income` LANGSUNG pada akun investment, bukan transfer —
lihat `konsep-investasi.md` "Unit yang berubah TANPA transfer kas").
Transaksi hasil `direct` diedit lewat form transaksi UTAMA tetap
`type: 'income'` (field `type` tidak ikut berubah jadi transfer) —
delete-lalu-`applyInvestmentTransaction` berarti baris lama terhapus
TANPA pengganti sama sekali, karena pemanggilan keduanya cuma jalan
untuk transfer.

Perbaikan: begitu ada baris lama DAN `type` baru BUKAN `'transfer'`,
berarti ini tetap transaksi direct yang sekadar dikoreksi nilainya —
UPDATE baris yang sama in-place (unit/harga/tanggal), TIDAK delete+
recreate. Delete+recreate lewat `applyInvestmentTransaction` cuma
masih valid untuk kasus `type === 'transfer'` (transaksi memang
transfer kas<->investment, pola lama yang sudah terbukti aman).

**Revisi 2026-10-08 (bug KEDUA ditemukan lewat tes manual fix di
atas)**: `unit`/`pricePerUnit` dari `input` TIDAK selalu bisa
dipercaya apa adanya untuk cabang `type !== 'transfer'` — field
unit/harga TIDAK PERNAH dirender di form transaksi utama untuk
income/expense (`needsInvestmentFields` di
`use-transaction-investment-fields.ts` exclusive untuk transfer), dan
`defaultValues()` form (`use-update-transaction.ts`) membaca
`investmentPurchase` dari query React Query yang ASYNC — dialog bisa
submit SEBELUM query itu resolve (race condition, form dirender begitu
`transaction` siap tanpa menunggu `investmentPurchase`), mengirim
`unit`/`pricePerUnit` berupa `null` walau baris lama punya nilai asli.
Fallback ke nilai LAMA (`existing.unit`/`existing.price_per_unit`)
kalau input baru `null` — user tidak pernah bisa sengaja mengosongkan
field yang bahkan tidak ditampilkan di form.

**Relevansi untuk income/expense direct ke `debt`** (lihat
[docs/todos/plan/unify-direct-writeoff-into-main-transaction-form.md](../../../../../docs/todos/plan/unify-direct-writeoff-into-main-transaction-form.md)):
kedua bug di atas membuktikan jalur `direct` untuk investment SUDAH
ADA sebelumnya (`new-purchase-form`) dan SUDAH pernah menyebabkan bug
nyata saat diedit lewat form transaksi utama. Begitu domain Utang-
Piutang (sudah selesai Jalur Create, lihat dokumen itu) lanjut ke
Jalur Update, pola fix yang sama (UPDATE in-place utk `type !==
'transfer'`, fallback ke nilai lama kalau field tidak dirender)
kemungkinan relevan diterapkan ke `applyDebtTransactionEdit` juga —
BELUM dicek, jangan diasumsikan otomatis sama.

## delete.ts

`detachInvestmentPurchaseForDeletedTransaction` — dipanggil SEBELUM
hard-delete baris `transactions` (lihat `use-delete-transaction.ts`) —
port pola `detachDebtForDeletedTransaction`
(`apply-debt-transaction.ts`), tapi lebih sederhana:
`investment_purchases` TIDAK punya baris anak (beda dari `debts` yang
bisa sudah dicicil), jadi cukup hard-delete baris itu sekalian — tidak
ada yang kehilangan jejak nominalnya, karena `investment_purchases`
BUKAN tumpuan `accounts.balance` (itu tetap murni dari `transactions`,
lihat `konsep-investasi.md`).

## apply-investment-transaction.test.ts

Fake DB in-memory meniru HANYA pola SQL yang dipakai folder ini — pola
sama fake db di `apply-debt-transaction.test.ts` (lihat README di
folder itu untuk alasan memilih fake ini alih-alih SQLite asli).

Catatan test case tertentu:
- "UPDATE in-place (bukan delete+recreate) kalau type bukan transfer":
  Regresi 2026-10-08 (dogfooding) — transaksi `'income'` hasil
  `record_mode: 'direct'` (`createDirectInvestmentPurchase`, lihat
  `konsep-investasi.md` "Unit yang berubah TANPA transfer kas") diedit
  lewat form transaksi UTAMA tetap `type='income'` (bukan `'transfer'`)
  — sebelum fix ini, baris lama dihapus lalu `applyInvestmentTransaction`
  dipanggil yang `return none` untuk `type !== 'transfer'`, jadi baris
  `investment_purchases` hilang TANPA pengganti sama sekali.
- "fallback ke unit/price_per_unit LAMA kalau input baru null": Regresi
  KEDUA 2026-10-08 (ditemukan lewat tes manual fix di atas) —
  unit/pricePerUnit null dari form (field-nya TIDAK PERNAH dirender
  untuk income/expense, dan `defaultValues()` `use-update-
  transaction.ts` bisa submit sebelum query `investmentPurchase` React
  Query selesai resolve) TIDAK BOLEH menimpa nilai lama yang sudah
  benar.
