import { datePart, isAlive } from "../../shared";
import type { SyncSnapshot, Transaction } from "../../types";

export function listTransactions(
  snapshot: SyncSnapshot,
  options: {
    limit?: number;
    from?: string;
    to?: string;
    type?: Transaction["type"];
    accountId?: string;
    transferDirection?: "from" | "to";
    categoryId?: string;
    contactId?: string;
    query?: string;
    minAmount?: number;
    maxAmount?: number;
  } = {}
): Transaction[] {
  const limit = options.limit ?? 20;
  const queryLower = options.query?.toLowerCase();
  return snapshot.transactions
    .filter((t) => isAlive(t))
    .filter((t) => !options.from || datePart(t.date) >= options.from)
    .filter((t) => !options.to || datePart(t.date) <= options.to)
    .filter((t) => !options.type || t.type === options.type)
    .filter((t) => {
      if (!options.accountId) return true;
      if (options.transferDirection === "from") return t.accountId === options.accountId;
      if (options.transferDirection === "to") return t.transferAccountId === options.accountId;
      return t.accountId === options.accountId || t.transferAccountId === options.accountId;
    })
    .filter((t) => !options.categoryId || t.categoryId === options.categoryId)
    .filter((t) => !options.contactId || t.contactId === options.contactId)
    .filter(
      (t) =>
        !queryLower ||
        t.note.toLowerCase().includes(queryLower) ||
        (t.description?.toLowerCase().includes(queryLower) ?? false)
    )
    .filter((t) => options.minAmount == null || t.amount >= options.minAmount)
    .filter((t) => options.maxAmount == null || t.amount <= options.maxAmount)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}
