# `hooks/helper`

Fungsi query kecil yang dipakai bersama oleh `use-create-transaction`
dan `use-update-transaction` (serta sub-kasus di dalamnya — income,
expense, transfer), supaya query INSERT tidak diduplikasi persis sama
di tiap file kasus.

- `insert-to-db.ts` — `insertTransactionToDb({ db, contactId, amount,
  transferAccountId, values })`, satu-satunya tempat query `INSERT INTO
  transactions`. `amount` dan `transferAccountId` diterima sebagai
  parameter terpisah (bukan diambil langsung dari `values`) karena
  keduanya bisa BERBEDA dari nilai mentah form — `amount` dihitung
  ulang dari `average_cost * unit` untuk jalur jual investasi,
  `transferAccountId` selalu `null` untuk income/expense walau
  `values.transfer_account_id` form mungkin masih menyimpan nilai lama.
- `update-to-db.ts` — `updateTransactionToDb({ db, transactionId,
  contactId, amount, transferAccountId, values })`, mirror `insert-to-db.ts`
  tapi `UPDATE transactions ... WHERE id = $10` (perlu `transactionId`
  tambahan karena baris sudah ada, bukan di-generate lewat `newId()`).
  Alasan `amount`/`transferAccountId` terpisah dari `values` SAMA
  dengan `insert-to-db.ts`.
- `apply-labels-and-push.ts` — `applyLabelsAndPush({ transactionId,
  labelNames })`, langkah PENUTUP yang WAJIB dipanggil setelah insert
  berhasil, untuk SEMUA jenis transaksi (income/expense/transfer) tanpa
  terkecuali: push baris `transactions` ke cloud sync (`pushOnWrite`),
  lalu resolve & attach label. Baris turunan lain (debt, investment)
  punya push-nya masing-masing di luar helper ini — lihat README
  `use-create-transaction/create-transaction/`.
