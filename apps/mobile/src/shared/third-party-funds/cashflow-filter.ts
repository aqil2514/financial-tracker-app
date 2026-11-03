// Titip/ambil di akun third_party tidak pernah mengubah kekayaan bersih (uang masuk menciptakan kewajiban
// setara untuk dikembalikan), jadi dikecualikan dari agregat Pendapatan/Pengeluaran LINTAS akun. Saldo per
// akun third_party sendiri tetap menghitung transaksinya apa adanya — jangan pakai filter ini di query saldo.
// Berbasis account_type (bukan flag per transaksi) supaya satu sumber kebenaran. NOT EXISTS (bukan NOT IN)
// supaya transaksi yang akunnya tidak ditemukan tetap terhitung. Dipakai bersama is_cash_neutral = 0, bukan menggantikannya.
export const EXCLUDE_THIRD_PARTY_TRANSACTIONS_SQL = `NOT EXISTS (
  SELECT 1 FROM accounts third_party_accounts
  WHERE third_party_accounts.id = transactions.account_id AND third_party_accounts.account_type = 'third_party'
)`;
