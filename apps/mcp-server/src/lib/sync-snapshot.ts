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

export type InvestmentAccount = {
  accountId: string;
  unitLabel: string;
  currentMarketValue: number;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type InvestmentPurchase = {
  id: string;
  accountId: string;
  transactionId: string | null;
  unit: number | null;
  pricePerUnit: number | null;
  date: string;
  status: "pending" | "settled";
  updatedAt: string | null;
  deletedAt: string | null;
};

export type InvestmentSale = {
  id: string;
  accountId: string;
  transactionId: string | null;
  adjustmentTransactionId: string | null;
  unit: number;
  pricePerUnit: number;
  averageCostPerUnit: number | null;
  realizedPl: number | null;
  date: string;
  status: "pending" | "settled";
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
  investmentAccounts: InvestmentAccount[];
  investmentPurchases: InvestmentPurchase[];
  investmentSales: InvestmentSale[];
};

export async function fetchFullSnapshot(
  workerFetch: <T>(path: string) => Promise<T>
): Promise<SyncSnapshot> {
  return workerFetch<SyncSnapshot>("/sync");
}

function isAlive<T extends { deletedAt: string | null }>(row: T): boolean {
  return row.deletedAt === null;
}

// `Transaction.date` TIDAK konsisten formatnya -- kadang "YYYY-MM-DD"
// polos, kadang "YYYY-MM-DDTHH:mm" (dgn jam). Filter from/to dari user
// SELALU "YYYY-MM-DD" tanpa jam. Perbandingan string APA ADANYA
// ("2026-10-06T18:04" <= "2026-10-06") salah -- string yg lebih panjang
// berprefix sama dianggap "lebih besar" secara leksikografis, jadi
// transaksi ber-jam pada tanggal `to` itu sendiri salah tereksklusi.
// Ambil 10 karakter pertama dulu supaya perbandingan selalu
// tanggal-vs-tanggal, bukan tanggal-vs-datetime.
function datePart(date: string): string {
  return date.slice(0, 10);
}

// Dipakai tool-tool "get"/"list" buat resolve ID mentah (accountId,
// categoryId, contactId) ke nama -- tanpa ini caller harus lookup manual
// via get_account_balances dulu tiap kali baca transaksi/debt.
export function buildNameLookups(snapshot: SyncSnapshot) {
  return {
    accountName: new Map(snapshot.accounts.map((a) => [a.id, a.name])),
    categoryName: new Map(snapshot.categories.map((c) => [c.id, c.name])),
    contactName: new Map(snapshot.contacts.map((c) => [c.id, c.name])),
  };
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

export function listAliveCategories(snapshot: SyncSnapshot): Category[] {
  return snapshot.categories.filter(isAlive);
}

export function summarizeExpenseByCategory(
  snapshot: SyncSnapshot,
  options: { from?: string; to?: string } = {}
): Array<{ categoryId: string | null; categoryName: string; total: number }> {
  const categoryById = new Map(snapshot.categories.map((c) => [c.id, c]));
  const totals = new Map<string, number>();

  for (const t of snapshot.transactions) {
    if (!isAlive(t) || t.type !== "expense") continue;
    if (options.from && datePart(t.date) < options.from) continue;
    if (options.to && datePart(t.date) > options.to) continue;
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

export type CashflowGroupBy = "account_group" | "parent_category";

// Cermin query SQL use-cashflow-breakdown.ts (desktop) -- breakdown kas
// masuk/keluar, TANPA join debts/debt_payments sama sekali: mode
// non_cash memang tidak pernah punya baris transactions, dan semua
// pergerakan kas riil (termasuk pokok utang/piutang & pelunasannya)
// sudah tercatat sebagai baris transactions biasa (lihat migrasi
// 0033_backfill_direct_debt_transactions.sql di desktop app) -- jadi
// query transactions saja sudah cukup & akurat. Transfer antar akun
// EXCLUDE dari kas masuk/keluar (type cuma income|expense).
//
// 2 dimensi breakdown: "account_group" (default, join ke
// accounts.groupId -> accountGroups.name) atau "parent_category"
// (kategori tanpa parentId dipakai namanya sendiri, kategori anak
// digabung ke nama induknya, transaksi tanpa kategori -> "Tanpa
// Kategori") -- cermin toggle yang sama di UI desktop.
export function summarizeCashflow(
  snapshot: SyncSnapshot,
  options: { from?: string; to?: string; groupBy?: CashflowGroupBy } = {}
): {
  income: { total: number; byGroup: Array<{ label: string; total: number }> };
  expense: { total: number; byGroup: Array<{ label: string; total: number }> };
} {
  const groupBy = options.groupBy ?? "account_group";
  const accountById = new Map(snapshot.accounts.map((a) => [a.id, a]));
  const groupNameById = new Map(
    snapshot.accountGroups.filter((g) => g.deletedAt === null).map((g) => [g.id, g.name])
  );
  const categoryById = new Map(snapshot.categories.map((c) => [c.id, c]));

  const labelFor = (t: Transaction): string => {
    if (groupBy === "parent_category") {
      const category = t.categoryId ? categoryById.get(t.categoryId) : undefined;
      if (!category) return "Tanpa Kategori";
      const parent = category.parentId ? categoryById.get(category.parentId) : undefined;
      return parent?.name ?? category.name;
    }

    const account = t.accountId ? accountById.get(t.accountId) : undefined;
    return account?.groupId ? (groupNameById.get(account.groupId) ?? "Tanpa Grup") : "Tanpa Grup";
  };

  const totalsByType: Record<"income" | "expense", Map<string, number>> = {
    income: new Map(),
    expense: new Map(),
  };

  for (const t of snapshot.transactions) {
    if (!isAlive(t)) continue;
    if (t.type !== "income" && t.type !== "expense") continue;
    if (options.from && datePart(t.date) < options.from) continue;
    if (options.to && datePart(t.date) > options.to) continue;

    const label = labelFor(t);
    const totals = totalsByType[t.type];
    totals.set(label, (totals.get(label) ?? 0) + t.amount);
  }

  const toByGroup = (totals: Map<string, number>) =>
    Array.from(totals.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total);

  const sumOf = (totals: Map<string, number>) =>
    Array.from(totals.values()).reduce((sum, v) => sum + v, 0);

  return {
    income: { total: sumOf(totalsByType.income), byGroup: toByGroup(totalsByType.income) },
    expense: { total: sumOf(totalsByType.expense), byGroup: toByGroup(totalsByType.expense) },
  };
}

export type BalanceTrendGranularity = "day" | "week" | "month" | "year";

function bucketLabel(date: string, granularity: BalanceTrendGranularity): string {
  // `date` format YYYY-MM-DD -- slice murni, cermin strftime SQLite di
  // use-balance-trend.ts (desktop), KECUALI "week" yang butuh hitungan
  // ISO-week manual (tidak ada strftime %W setara di TS tanpa lib date).
  if (granularity === "year") return date.slice(0, 4);
  if (granularity === "month") return date.slice(0, 7);
  if (granularity === "day") return date;

  const d = new Date(`${date}T00:00:00Z`);
  const startOfYear = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((d.getTime() - startOfYear.getTime()) / 86400000);
  const week = Math.floor(dayOfYear / 7);
  return `${d.getUTCFullYear()}-${String(week).padStart(2, "0")}`;
}

export type BalanceTrendFilter = {
  accountTypes?: AccountType[];
  groupIds?: string[];
  accountIds?: string[];
};

// Cermin strategi 2-fase use-balance-trend.ts (desktop): (1) saldo awal
// SEBELUM `from`, (2) net perubahan per titik granularitas DALAM
// rentang from..to, running sum digabung terakhir -- BUKAN re-SUM per
// titik dari awal waktu (lihat "Catatan performa" di
// apps/desktop/docs/todos/done/reports-page-redesign.md).
//
// Filter akun nonaktif: exclude SECARA DEFAULT (accountIds kosong) --
// begitu user pilih akun spesifik, filter isActive dilepas supaya
// pilihan eksplisit itu (termasuk akun nonaktif) tetap terhitung.
export function computeBalanceTrend(
  snapshot: SyncSnapshot,
  from: string,
  to: string,
  granularity: BalanceTrendGranularity,
  filter: BalanceTrendFilter = {}
): Array<{ label: string; balance: number }> {
  const accountTypes = filter.accountTypes ?? [];
  const groupIds = filter.groupIds ?? [];
  const accountIds = filter.accountIds ?? [];

  const matchesAccount = (account: Account | undefined): account is Account => {
    if (!account) return false;
    if (accountIds.length === 0 && !account.isActive) return false;
    if (accountTypes.length > 0 && !accountTypes.includes(account.accountType)) return false;
    if (groupIds.length > 0 && (!account.groupId || !groupIds.includes(account.groupId))) return false;
    if (accountIds.length > 0 && !accountIds.includes(account.id)) return false;
    return true;
  };

  const accountById = new Map(snapshot.accounts.map((a) => [a.id, a]));
  const matchingAccounts = snapshot.accounts.filter((a) => matchesAccount(a));

  let openingBalance = matchingAccounts.reduce((sum, a) => sum + a.initialBalance, 0);

  const buckets = new Map<string, number>();

  for (const t of snapshot.transactions) {
    if (!isAlive(t)) continue;

    const fromAccount = t.accountId ? accountById.get(t.accountId) : undefined;
    const toAccount = t.transferAccountId ? accountById.get(t.transferAccountId) : undefined;
    const fromMatches = matchesAccount(fromAccount);
    const toMatches = t.type === "transfer" && matchesAccount(toAccount);
    if (!fromMatches && !toMatches) continue;

    let net = 0;
    if (fromMatches) {
      if (t.type === "income") net += t.amount;
      else if (t.type === "expense" || t.type === "transfer") net -= t.amount;
    }
    if (toMatches) net += t.amount;

    if (datePart(t.date) < from) {
      openingBalance += net;
      continue;
    }
    if (datePart(t.date) > to) continue;

    const label = bucketLabel(t.date, granularity);
    buckets.set(label, (buckets.get(label) ?? 0) + net);
  }

  let running = openingBalance;
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, net]) => {
      running += net;
      return { label, balance: running };
    });
}

export function listTransactions(
  snapshot: SyncSnapshot,
  options: { limit?: number; from?: string; to?: string; type?: Transaction["type"]; accountId?: string } = {}
): Transaction[] {
  const limit = options.limit ?? 20;
  return snapshot.transactions
    .filter((t) => isAlive(t))
    .filter((t) => !options.from || datePart(t.date) >= options.from)
    .filter((t) => !options.to || datePart(t.date) <= options.to)
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
): { transactions: Transaction[]; debts: Array<Debt & { remaining: number; payments: DebtPayment[] }> } {
  return {
    transactions: snapshot.transactions.filter((t) => isAlive(t) && t.contactId === contactId),
    debts: listDebtDetails(snapshot, { contactId }),
  };
}

// Menutup gap cloud-sync.md Tahap 8: tanpa ini, Claude tidak punya cara
// menemukan transactionId satu baris cicilan (debt_payments) tertentu --
// padahal update_transaction/delete_transaction yang SUDAH ADA bisa
// langsung dipakai utk edit/hapus cicilan (Worker PATCH/DELETE
// /transactions/:id reuse applyDebtTransactionEdit/
// detachDebtForDeletedTransaction, sama seperti use-edit-payment.ts
// desktop) -- gap-nya murni di sisi BACA, bukan di Worker.
export function listDebtDetails(
  snapshot: SyncSnapshot,
  options: { debtId?: string; contactId?: string } = {}
): Array<Debt & { remaining: number; payments: DebtPayment[] }> {
  return snapshot.debts
    .filter((d) => isAlive(d))
    .filter((d) => !options.debtId || d.id === options.debtId)
    .filter((d) => !options.contactId || d.contactId === options.contactId)
    .map((d) => {
      const payments = snapshot.debtPayments.filter((p) => isAlive(p) && p.debtId === d.id);
      const paid = payments.reduce((sum, p) => sum + p.amount, 0);
      return { ...d, remaining: d.amount - paid, payments };
    });
}

// Port PERSIS getAverageCostPerUnit (apps/desktop/.../investment-holding-math.ts
// DAN apps/worker/.../investments/service.ts) -- SATU-SATUNYA rumus
// average cost, dipakai validasi oversell (getRemainingUnit di bawah)
// DAN tampilan ringkasan. Cuma baris `status='settled'` yg ikut dihitung
// (baris pending belum pasti unit/harganya).
export function getAverageCostPerUnit(snapshot: SyncSnapshot, accountId: string): number {
  let totalCost = 0;
  let totalUnit = 0;
  for (const p of snapshot.investmentPurchases) {
    if (!isAlive(p) || p.accountId !== accountId || p.status !== "settled") continue;
    totalCost += (p.unit ?? 0) * (p.pricePerUnit ?? 0);
    totalUnit += p.unit ?? 0;
  }
  return totalUnit !== 0 ? totalCost / totalUnit : 0;
}

// Port PERSIS getRemainingUnit -- sisa unit yang BISA DIJUAL (validasi
// oversell), BEDA dari totalUnit di getInvestmentHolding (yang
// mengikutkan pembelian pending, basis Unrealized P/L). Penjualan
// pending SUDAH dikurangi (optimis, simetris pembelian).
export function getRemainingUnit(snapshot: SyncSnapshot, accountId: string): number {
  let settledPurchased = 0;
  for (const p of snapshot.investmentPurchases) {
    if (!isAlive(p) || p.accountId !== accountId || p.status !== "settled") continue;
    settledPurchased += p.unit ?? 0;
  }
  let sold = 0;
  for (const s of snapshot.investmentSales) {
    if (!isAlive(s) || s.accountId !== accountId) continue;
    if (s.status !== "pending" && s.status !== "settled") continue;
    sold += s.unit;
  }
  return settledPurchased - sold;
}

// Port PERSIS InvestmentPlStats (desktop) -- Unrealized P/L dihitung dari
// `balance` akun (modal posisi aktif, live dari transactions via
// computeAccountBalance), BUKAN average cost x remainingUnit. `totalUnit`
// di sini SUM SEMUA pembelian (termasuk pending yg unit-nya terisi) --
// basis BEDA dari getRemainingUnit (yg cuma settled), lihat komentar
// investment-pl-stats.tsx desktop soal kenapa dua "total unit" ini
// sengaja berbeda.
export function getInvestmentHolding(
  snapshot: SyncSnapshot,
  accountId: string
): {
  balance: number;
  marketValue: number;
  unrealizedPl: number;
  unrealizedPlPercent: number;
  totalUnit: number;
  averageCost: number | null;
  remainingUnit: number;
} | null {
  const investmentAccount = snapshot.investmentAccounts.find((a) => a.accountId === accountId && isAlive(a));
  if (!investmentAccount) return null;

  const balance = computeAccountBalance(snapshot, accountId) ?? 0;
  const marketValue = investmentAccount.currentMarketValue;
  const unrealizedPl = marketValue - balance;
  const unrealizedPlPercent = balance !== 0 ? (unrealizedPl / balance) * 100 : 0;

  let totalUnit = 0;
  for (const p of snapshot.investmentPurchases) {
    if (!isAlive(p) || p.accountId !== accountId) continue;
    totalUnit += p.unit ?? 0;
  }
  const averageCost = totalUnit !== 0 ? balance / totalUnit : null;

  return {
    balance,
    marketValue,
    unrealizedPl,
    unrealizedPlPercent,
    totalUnit,
    averageCost,
    remainingUnit: getRemainingUnit(snapshot, accountId),
  };
}

// Ringkasan LINTAS semua akun investment -- pola sama summarizeDebts,
// dipakai get_investment_summary (tool baru, Tahap 4). Realized P/L
// dihitung dari SELURUH investment_sales berstatus settled (snapshot
// permanen saat settle, lihat apply-sell-investment-transaction.ts),
// tanpa filter tanggal -- cermin halaman /investments ringkasan desktop.
export function summarizeInvestments(snapshot: SyncSnapshot): {
  accounts: Array<{
    accountId: string;
    accountName: string;
    unitLabel: string;
    balance: number;
    marketValue: number;
    unrealizedPl: number;
    unrealizedPlPercent: number;
    totalUnit: number;
    averageCost: number | null;
    remainingUnit: number;
  }>;
  totalUnrealizedPl: number;
  totalRealizedPl: number;
};
export function summarizeInvestments(snapshot: SyncSnapshot) {
  const accountById = new Map(snapshot.accounts.map((a) => [a.id, a]));

  const accounts = snapshot.investmentAccounts
    .filter((a) => isAlive(a))
    .map((a) => {
      const holding = getInvestmentHolding(snapshot, a.accountId);
      const account = accountById.get(a.accountId);
      return {
        accountId: a.accountId,
        accountName: account?.name ?? "Tidak diketahui",
        unitLabel: a.unitLabel,
        balance: holding?.balance ?? 0,
        marketValue: holding?.marketValue ?? a.currentMarketValue,
        unrealizedPl: holding?.unrealizedPl ?? 0,
        unrealizedPlPercent: holding?.unrealizedPlPercent ?? 0,
        totalUnit: holding?.totalUnit ?? 0,
        averageCost: holding?.averageCost ?? null,
        remainingUnit: holding?.remainingUnit ?? 0,
      };
    });

  const totalUnrealizedPl = accounts.reduce((sum, a) => sum + a.unrealizedPl, 0);
  const totalRealizedPl = snapshot.investmentSales
    .filter((s) => isAlive(s) && s.status === "settled")
    .reduce((sum, s) => sum + (s.realizedPl ?? 0), 0);

  return { accounts, totalUnrealizedPl, totalRealizedPl };
}

// Riwayat lot (pembelian + penjualan) satu akun investment -- pola sama
// listDebtDetails, dipakai get_investment_detail (tool baru, Tahap 4).
export function listInvestmentDetail(
  snapshot: SyncSnapshot,
  accountId: string
): {
  purchases: InvestmentPurchase[];
  sales: InvestmentSale[];
} {
  return {
    purchases: snapshot.investmentPurchases.filter((p) => isAlive(p) && p.accountId === accountId),
    sales: snapshot.investmentSales.filter((s) => isAlive(s) && s.accountId === accountId),
  };
}
