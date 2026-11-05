// SELECT daftar transaksi lengkap dengan nama kategori dan akun, bentuknya sama dengan
// features/transactions/content/use-transactions.ts (TransactionRow). Pemanggil menambahkan
// JOIN/WHERE/ORDER BY sendiri.
export const TRANSACTION_LIST_SELECT = `
  SELECT transactions.*,
    (SELECT name FROM categories WHERE categories.id = transactions.category_id) AS category_name,
    (SELECT name FROM accounts WHERE accounts.id = transactions.account_id) AS account_name,
    (SELECT name FROM accounts WHERE accounts.id = transactions.transfer_account_id) AS transfer_account_name
  FROM transactions`;
