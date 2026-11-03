import type { TransactionFormValues } from "./schema";
import { toLocalDateTime } from "@/lib/utils/local-datetime";

export function emptyTransactionValues(): TransactionFormValues {
  return {
    type: "expense",
    amount: 0,
    account_id: "",
    category_id: null,
    transfer_account_id: null,
    note: "",
    description: null,
    date: toLocalDateTime(),
    contact_id: null,
    settle_debt_ids: [],
  };
}
