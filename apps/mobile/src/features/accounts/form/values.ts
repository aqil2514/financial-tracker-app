import type { AccountFormValues } from "./schema";

export function emptyAccountValues(): AccountFormValues {
  return {
    kind: "account",
    name: "",
    icon: null,
    color: null,
    group_id: null,
    initial_balance: 0,
    description: null,
    is_active: "true",
    account_type: "cash",
    direction: null,
    unit_label: null,
    current_market_value: 0,
    forex_country: null,
    forex_currency: null,
    forex_current_rate: 0,
    label_names: [],
  };
}
