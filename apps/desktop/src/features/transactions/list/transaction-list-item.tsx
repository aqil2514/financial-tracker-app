"use client";

import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight } from "lucide-react";

import { formatRupiah, formatDateTime } from "@/lib/format";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Badge } from "@/components/ui/badge";
import type { Transaction } from "@/lib/db";
import { TransactionEditDialog } from "../form/transaction-edit-dialog";
import { useList } from "./list-context";

const typeConfig = {
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

export const TransactionListItem = ({ tx }: { tx: Transaction }) => {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <ItemInfo tx={tx} />
      <ItemActions tx={tx} />
    </div>
  );
};

const ItemInfo = ({ tx }: { tx: Transaction }) => {
  const { accountName, categoryName } = useList();
  const config = typeConfig[tx.type];
  const Icon = config.icon;
  const transactionType =
    tx.type === "transfer"
      ? `${accountName(tx.account_id)} → ${accountName(tx.transfer_account_id)}`
      : accountName(tx.account_id);

  return (
    <div className="flex items-center gap-3">
      <Icon className={`size-5 shrink-0 ${config.className}`} />
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{transactionType}</p>
          {categoryName(tx.category_id) && (
            <Badge variant="secondary">{categoryName(tx.category_id)}</Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          {formatDateTime(tx.date)}
        </p>
        {tx.note && <p className="text-muted-foreground text-xs">{tx.note}</p>}
      </div>
    </div>
  );
};

const ItemActions = ({ tx }: { tx: Transaction }) => {
  const { deleteTransaction, isDeletingTransaction } = useList();
  const config = typeConfig[tx.type];

  return (
    <div className="flex items-center gap-1">
      <p className={`mr-2 font-medium ${config.className}`}>
        {tx.type === "expense" ? "-" : tx.type === "income" ? "+" : ""}
        {formatRupiah(tx.amount)}
      </p>
      <TransactionEditDialog transaction={tx} />
      <ConfirmDeleteButton
        onConfirm={() => deleteTransaction(tx.id)}
        isPending={isDeletingTransaction}
        title="Hapus transaksi ini?"
      />
    </div>
  );
};
