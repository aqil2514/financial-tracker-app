import type { TransactionFormValues } from "./schema";

function now() {
  const date = new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function defaultTransactionValues(
  overrides?: Partial<TransactionFormValues>
): TransactionFormValues {
  return {
    type: "expense",
    amount: 0,
    account_id: "",
    category_id: null,
    transfer_account_id: null,
    note: "",
    description: null,
    date: now(),
    contact_name: null,
    debt_action: null,
    settle_debt_ids: [],
    unit: null,
    price_per_unit: null,
    investment_status: "pending",
    label_names: [],
    ...overrides,
  };
}
