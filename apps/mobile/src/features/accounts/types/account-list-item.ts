export interface AccountListItem {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  accountType: "cash" | "debt" | "investment" | "third_party";
  groupId: string | null;
  groupName: string | null;
  isActive: boolean;
  balance: number;
}
