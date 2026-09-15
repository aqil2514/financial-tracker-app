import type { Account, Transaction } from "@/lib/db";

export type AccountWithBalance = Account & { balance: number };

export function calculateAccountBalance(
  account: Account,
  transactions: Transaction[]
): number {
  return transactions.reduce((sum, tx) => {
    if (tx.account_id === account.id) {
      if (tx.type === "income") return sum + tx.amount;
      if (tx.type === "expense") return sum - tx.amount;
      if (tx.type === "transfer") return sum - tx.amount;
    }
    if (tx.type === "transfer" && tx.transfer_account_id === account.id) {
      return sum + tx.amount;
    }
    return sum;
  }, account.initial_balance);
}

export function withBalances(
  accounts: Account[],
  transactions: Transaction[]
): AccountWithBalance[] {
  return accounts.map((account) => ({
    ...account,
    balance: calculateAccountBalance(account, transactions),
  }));
}
