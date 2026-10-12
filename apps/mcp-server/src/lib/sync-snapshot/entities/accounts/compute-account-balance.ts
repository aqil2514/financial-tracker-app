import { isAlive } from "../../shared";
import type { SyncSnapshot } from "../../types";

export function computeAccountBalance(snapshot: SyncSnapshot, accountId: string): number | null {
  const account = snapshot.accounts.find((a) => a.id === accountId && isAlive(a));
  if (!account) return null;

  let balance = account.initialBalance;
  for (const t of snapshot.transactions) {
    if (!isAlive(t)) continue;
    if (t.accountId === accountId) {
      if (t.type === "income") balance += t.amount;
      else if (t.type === "expense" || t.type === "transfer") balance -= t.amount;
    }
    if (t.type === "transfer" && t.transferAccountId === accountId) {
      balance += t.amount;
    }
  }
  return balance;
}
