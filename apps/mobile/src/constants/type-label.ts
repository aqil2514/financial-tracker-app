import { TransactionListItem } from "@/features/transactions/types";

export const TYPE_LABEL: Record<TransactionListItem["type"], string> = {
  income: "Pemasukan",
  expense: "Pengeluaran",
  transfer: "Transfer",
};
