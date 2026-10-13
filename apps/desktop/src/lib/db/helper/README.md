# `db/helper`

Fungsi query kecil lintas-fitur yang dipakai berulang di banyak
hook/mutation, dikumpulkan di sini supaya tidak terus-menerus
diduplikasi per file (mis. `getAccountType` sebelumnya didefinisikan
sendiri-sendiri di `use-create-transaction` dan `use-update-transaction`).

- `get-account-type.ts` — `getAccountType(db, accountId)`, query
  `account_type` dari tabel `accounts` lewat koneksi `Db` yang sudah
  ada (bukan `getDb()` sendiri) supaya tetap satu koneksi/transaksi
  yang sama dengan pemanggil.
