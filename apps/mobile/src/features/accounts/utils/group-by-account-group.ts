import { AccountListItem } from "../types";

export interface AccountGroupSection {
  id: string;
  groupId: string | null;
  title: string;
  data: AccountListItem[];
}

const UNGROUPED_ID = "ungrouped";

export function groupByAccountGroup(accounts: AccountListItem[]): AccountGroupSection[] {
  const sectionsByGroupId = new Map<string, AccountGroupSection>();
  const ungrouped: AccountListItem[] = [];

  for (const account of accounts) {
    if (account.groupId == null) {
      ungrouped.push(account);
      continue;
    }

    const existing = sectionsByGroupId.get(account.groupId);
    if (existing) {
      existing.data.push(account);
      continue;
    }

    sectionsByGroupId.set(account.groupId, {
      id: account.groupId,
      groupId: account.groupId,
      title: account.groupName ?? "",
      data: [account],
    });
  }

  const sections = Array.from(sectionsByGroupId.values()).sort((a, b) =>
    a.title.localeCompare(b.title)
  );

  if (ungrouped.length > 0) {
    sections.push({
      id: UNGROUPED_ID,
      groupId: null,
      title: "Tanpa Grup",
      data: ungrouped,
    });
  }

  return sections;
}
