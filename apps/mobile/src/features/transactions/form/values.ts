import type { TransactionFormValues } from "./schema";

export function emptyTransactionValues(): TransactionFormValues {
  return {
    type: "expense",
    amount: 0,
    account_id: "",
    category_id: null,
    transfer_account_id: null,
    note: "",
    description: null,
    date: new Date().toISOString().slice(0, 10),
  };
}
