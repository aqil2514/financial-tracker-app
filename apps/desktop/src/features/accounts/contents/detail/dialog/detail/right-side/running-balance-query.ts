import type { Transaction } from "@/lib/db";

export type TransactionWithRunningBalance = Transaction & { running_balance: number };

/**
 * Saldo berjalan per transaksi (dari sudut pandang SATU akun), dihitung
 * mundur dari saldo akun saat ini — bukan maju dari 0 — karena list
 * ditampilkan `date DESC` (terbaru dulu). `signed_amount` mengikuti tanda
 * yang sama seperti `use-accounts.ts` (SELECT_ACCOUNTS_WITH_BALANCE):
 * +income, -expense, -transfer keluar (account_id = akun ini),
 * +transfer masuk (transfer_account_id = akun ini).
 *
 * `SUM() OVER (ORDER BY date ASC, id ASC)` dihitung terhadap SELURUH
 * transaksi akun ini (bukan cuma yang ditampilkan/di-LIMIT), supaya baris
 * ke-N tetap akurat walau tab "Terbaru" hanya menampilkan N transaksi
 * teratas — filter tambahan (mis. bulan tertentu) diterapkan di WHERE
 * setelah CTE, bukan di dalamnya, supaya window function tetap menghitung
 * dari basis lengkap.
 */
export function buildRunningBalanceQuery({
  extraWhere = "",
  limitClause = "",
}: {
  extraWhere?: string;
  limitClause?: string;
} = {}) {
  return `
    WITH ordered_tx AS (
      SELECT
        transactions.*,
        (
          (SELECT initial_balance FROM accounts WHERE id = $1)
          + SUM(
              CASE
                WHEN type = 'income' THEN amount
                WHEN type = 'expense' THEN -amount
                WHEN type = 'transfer' AND account_id = $1 THEN -amount
                WHEN type = 'transfer' AND transfer_account_id = $1 THEN amount
                ELSE 0
              END
            ) OVER (ORDER BY date ASC, id ASC)
        ) AS running_balance
      FROM transactions
      WHERE account_id = $1 OR transfer_account_id = $1
    )
    SELECT * FROM ordered_tx
    ${extraWhere}
    ORDER BY date DESC, id DESC
    ${limitClause}
  `;
}
