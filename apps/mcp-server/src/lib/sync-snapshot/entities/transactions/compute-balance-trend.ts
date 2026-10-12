import { datePart, isAlive } from "../../shared";
import type { AccountType } from "../../../account-types";
import type { Account, SyncSnapshot } from "../../types";

export type BalanceTrendGranularity = "day" | "week" | "month" | "year";

function bucketLabel(date: string, granularity: BalanceTrendGranularity): string {
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
