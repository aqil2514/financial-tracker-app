import { TransactionListItem } from "@/features/transactions/types";

export const AMOUNT_COLOR: Record<TransactionListItem["type"], string> = {
  income: "text-emerald-600",
  expense: "text-red-600",
  transfer: "text-neutral-900",
};