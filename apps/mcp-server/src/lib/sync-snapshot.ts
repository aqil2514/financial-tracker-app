// Tipe SyncResponse -- duplikat SENGAJA dari apps/worker/src/modules/sync/service.ts
// (tidak ada package bersama lintas-app), harus di-update manual kalau
// bentuk response /sync berubah di Worker.

import type { AccountType } from "./account-types";

export type AccountGroup = { id: string; name: string; updatedAt: string | null; deletedAt: string | null };

export type Category = {
  id: string;
  name: string;
  icon: string | null;
  type: "income" | "expense";
  parentId: string | null;
  isActive: boolean;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type Contact = { id: string; name: string; note: string | null; updatedAt: string | null; deletedAt: string | null };

export type Account = {
  id: string;
  name: string;
  icon: string | null;
  initialBalance: number;
  groupId: string | null;
  description: string | null;
  isActive: boolean;
  accountType: AccountType;
  color: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type Transaction = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  categoryId: string | null;
  accountId: string | null;
  transferAccountId: string | null;
  note: string;
  date: string;
  description: string | null;
  contactId: string | null;
  source: "manual" | "retailku_sync";
  sourceRef: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type Debt = {
  id: string;
  type: "receivable" | "payable";
  contactId: string | null;
  amount: number;
  accountId: string | null;
  transactionId: string | null;
  status: "ongoing" | "paid" | "written_off";
  note: string | null;
  date: string;
  source: "manual" | "retailku_sync";
  sourceRef: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type DebtPayment = {
  id: string;
  debtId: string;
  amount: number;
  accountId: string | null;
  transactionId: string | null;
  note: string | null;
  date: string;
  source: "manual" | "retailku_sync";
  sourceRef: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type SyncSnapshot = {
  checkpoint: string;
  accountGroups: AccountGroup[];
  categories: Category[];
  contacts: Contact[];
  accounts: Account[];
  transactions: Transaction[];
  debts: Debt[];
  debtPayments: DebtPayment[];
};

export async function fetchFullSnapshot(
  workerFetch: <T>(path: string) => Promise<T>
): Promise<SyncSnapshot> {
  return workerFetch<SyncSnapshot>("/sync");
}

function isAlive<T extends { deletedAt: string | null }>(row: T): boolean {
  return row.deletedAt === null;
}

// Formula SAMA PERSIS dgn getAccountBalance() di apps/worker/src/modules/accounts/service.ts --
// initial_balance + income - expense - transfer keluar + transfer masuk,
// cuma baris transaksi hidup (deletedAt null) yg dihitung.
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

export function listAliveAccounts(snapshot: SyncSnapshot): Account[] {
  return snapshot.accounts.filter(isAlive);
}

export function summarizeExpenseByCategory(
  snapshot: SyncSnapshot,
  options: { from?: string; to?: string } = {}
): Array<{ categoryId: string | null; categoryName: string; total: number }> {
  const categoryById = new Map(snapshot.categories.map((c) => [c.id, c]));
  const totals = new Map<string, number>();

  for (const t of snapshot.transactions) {
    if (!isAlive(t) || t.type !== "expense") continue;
    if (options.from && t.date < options.from) continue;
    if (options.to && t.date > options.to) continue;
    const key = t.categoryId ?? "__uncategorized__";
    totals.set(key, (totals.get(key) ?? 0) + t.amount);
  }

  return Array.from(totals.entries())
    .map(([categoryId, total]) => ({
      categoryId: categoryId === "__uncategorized__" ? null : categoryId,
      categoryName:
        categoryId === "__uncategorized__" ? "Tanpa kategori" : (categoryById.get(categoryId)?.name ?? "Tidak diketahui"),
      total,
    }))
    .sort((a, b) => b.total - a.total);
}

export function listTransactions(
  snapshot: SyncSnapshot,
  options: { limit?: number; from?: string; to?: string; type?: Transaction["type"]; accountId?: string } = {}
): Transaction[] {
  const limit = options.limit ?? 20;
  return snapshot.transactions
    .filter((t) => isAlive(t))
    .filter((t) => !options.from || t.date >= options.from)
    .filter((t) => !options.to || t.date <= options.to)
    .filter((t) => !options.type || t.type === options.type)
    .filter((t) => !options.accountId || t.accountId === options.accountId || t.transferAccountId === options.accountId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

export function summarizeDebts(snapshot: SyncSnapshot): {
  receivable: { ongoing: number; count: number };
  payable: { ongoing: number; count: number };
} {
  const summary = {
    receivable: { ongoing: 0, count: 0 },
    payable: { ongoing: 0, count: 0 },
  };

  const paidByDebt = new Map<string, number>();
  for (const p of snapshot.debtPayments) {
    if (!isAlive(p)) continue;
    paidByDebt.set(p.debtId, (paidByDebt.get(p.debtId) ?? 0) + p.amount);
  }

  for (const d of snapshot.debts) {
    if (!isAlive(d) || d.status !== "ongoing") continue;
    const paid = paidByDebt.get(d.id) ?? 0;
    const remaining = d.amount - paid;
    const bucket = d.type === "receivable" ? summary.receivable : summary.payable;
    bucket.ongoing += remaining;
    bucket.count += 1;
  }

  return summary;
}

export function listContactHistory(
  snapshot: SyncSnapshot,
  contactId: string
): { transactions: Transaction[]; debts: Debt[] } {
  return {
    transactions: snapshot.transactions.filter((t) => isAlive(t) && t.contactId === contactId),
    debts: snapshot.debts.filter((d) => isAlive(d) && d.contactId === contactId),
  };
}
