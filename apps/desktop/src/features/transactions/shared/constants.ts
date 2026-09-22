import { ArrowDownCircle, ArrowLeftRight, ArrowUpCircle } from "lucide-react";

export const typeConfig = {
  income: {
    label: "Pemasukan",
    icon: ArrowUpCircle,
    className: "text-green-600",
  },
  expense: {
    label: "Pengeluaran",
    icon: ArrowDownCircle,
    className: "text-red-600",
  },
  transfer: {
    label: "Transfer",
    icon: ArrowLeftRight,
    className: "text-blue-600",
  },
};
