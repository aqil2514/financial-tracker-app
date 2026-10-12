import type { SyncSnapshot } from "./types";

export function isAlive<T extends { deletedAt: string | null }>(row: T): boolean {
  return row.deletedAt === null;
}

export function datePart(date: string): string {
  return date.slice(0, 10);
}

export function buildNameLookups(snapshot: SyncSnapshot) {
  return {
    accountName: new Map(snapshot.accounts.map((a) => [a.id, a.name])),
    categoryName: new Map(snapshot.categories.map((c) => [c.id, c.name])),
    contactName: new Map(snapshot.contacts.map((c) => [c.id, c.name])),
  };
}
