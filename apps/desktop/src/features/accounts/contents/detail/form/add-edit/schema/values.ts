import type { Account } from "@/lib/db";
import { DEFAULT_ACCOUNT_COLOR } from "@/lib/account-colors";
import type { AccountFormValues } from "./schema";

export function defaultAccountValues(): AccountFormValues {
  return {
    name: "",
    initial_balance: 0,
    group_id: null,
    description: null,
    is_active: "1",
    account_type: "cash",
    icon: null,
    color: DEFAULT_ACCOUNT_COLOR,
    unit_label: null,
    current_market_value: null,
    debt_direction: null,
    label_names: [],
  };
}

export function accountValuesFromEntity(
  account: Account,
  extra?: {
    unit_label?: string | null;
    current_market_value?: number | null;
    debt_direction?: "receivable" | "payable" | null;
    label_names?: string[];
  }
): AccountFormValues {
  return {
    name: account.name,
    initial_balance: account.initial_balance,
    group_id: account.group_id != null ? String(account.group_id) : null,
    description: account.description,
    is_active: String(account.is_active) as "1" | "0",
    account_type: account.account_type,
    icon: account.icon,
    color: account.color,
    unit_label: extra?.unit_label ?? null,
    current_market_value: extra?.current_market_value ?? null,
    debt_direction: extra?.debt_direction ?? null,
    label_names: extra?.label_names ?? [],
  };
}
