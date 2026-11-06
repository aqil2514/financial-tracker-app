export type LabelScope = "transaction_category" | "account";

export interface LabelListItem {
  id: string;
  name: string;
  scope: LabelScope;
}
