import type { Transaction } from "@/lib/db";
import { parseDescription } from "@/components/rich-text";
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
    settle_debt_ids: [],
    unit: null,
    price_per_unit: null,
    investment_status: "pending",
    label_names: [],
    source_ref: null,
    ...overrides,
  };
}

type TransactionValuesFromRowExtras = {
  contactName: string | null;
  unit: number | null;
  pricePerUnit: number | null;
  investmentStatus: "pending" | "settled";
  labelNames: string[];
};

export function transactionValuesFromRow(
  transaction: Transaction,
  extras: TransactionValuesFromRowExtras
): TransactionFormValues {
  return {
    type: transaction.type,
    amount: transaction.amount,
    account_id: transaction.account_id ?? "",
    category_id: transaction.category_id,
    transfer_account_id: transaction.transfer_account_id,
    note: transaction.note,
    description: parseDescription(transaction.description),
    date: transaction.date,
    contact_name: extras.contactName,
    settle_debt_ids: [],
    unit: extras.unit,
    price_per_unit: extras.pricePerUnit,
    investment_status: extras.investmentStatus,
    label_names: extras.labelNames,
    source_ref: null,
  };
}
