import type { Label, SyncSnapshot } from "./types";

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

export function buildLabelNameLookup<J extends { labelId: string; deletedAt: string | null }>(
  junctionRows: J[],
  labels: Label[],
  entityIdOf: (row: J) => string
): Map<string, string[]> {
  const labelNameById = new Map(labels.filter(isAlive).map((l) => [l.id, l.name]));
  const result = new Map<string, string[]>();

  for (const row of junctionRows) {
    if (!isAlive(row)) continue;
    const labelName = labelNameById.get(row.labelId);
    if (!labelName) continue;
    const entityId = entityIdOf(row);
    const names = result.get(entityId);
    if (names) names.push(labelName);
    else result.set(entityId, [labelName]);
  }

  return result;
}
