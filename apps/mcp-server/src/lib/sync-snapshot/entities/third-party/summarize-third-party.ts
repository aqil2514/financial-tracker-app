import { isAlive } from "../../shared";
import type { SyncSnapshot } from "../../types";

// Port PERSIS rumus
// apps/desktop/src/features/third-party/content/summary/use-third-party-summary.ts
// -- breakdown "siapa titip berapa di mana" per (account_id, contact_id),
// HANYA pasangan yang sisanya != 0 (pasangan yang sudah lunas/habis tidak
// relevan ditampilkan, sama alasan dgn desktop HAVING remaining != 0).
export function summarizeThirdParty(
  snapshot: SyncSnapshot,
  options: { accountId?: string; contactId?: string } = {}
): Array<{ accountId: string; accountName: string; contactId: string; contactName: string; remaining: number }> {
  const remainingByPair = new Map<string, number>();

  for (const f of snapshot.thirdPartyFunds) {
    if (!isAlive(f)) continue;
    if (options.accountId && f.accountId !== options.accountId) continue;
    if (options.contactId && f.contactId !== options.contactId) continue;

    const key = `${f.accountId}::${f.contactId}`;
    const delta = f.direction === "in" ? f.amount : -f.amount;
    remainingByPair.set(key, (remainingByPair.get(key) ?? 0) + delta);
  }

  const accountName = new Map(snapshot.accounts.map((a) => [a.id, a.name]));
  const contactName = new Map(snapshot.contacts.map((c) => [c.id, c.name]));

  const result: Array<{ accountId: string; accountName: string; contactId: string; contactName: string; remaining: number }> =
    [];
  for (const [key, remaining] of remainingByPair) {
    if (remaining === 0) continue;
    const [accountId, contactId] = key.split("::");
    result.push({
      accountId,
      accountName: accountName.get(accountId) ?? accountId,
      contactId,
      contactName: contactName.get(contactId) ?? contactId,
      remaining,
    });
  }

  return result;
}
