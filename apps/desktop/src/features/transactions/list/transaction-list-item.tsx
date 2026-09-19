"use client";

import { useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  AlignLeft,
  Eye,
  ImageIcon,
  Pencil,
  Trash2,
} from "lucide-react";

import { formatDate } from "@/lib/format-date";
import { formatCurrency } from "@/lib/format-currency";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { ListItemActionsMenu } from "@/components/list-item-actions-menu";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TransactionEditDialog } from "../form/transaction-edit-dialog";
import { TransactionDetailDialog } from "./transaction-detail-dialog";
import { useList } from "./list-context";
import type { TransactionListRow } from "./use-transactions";

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

export const TransactionListItem = ({ tx }: { tx: TransactionListRow }) => {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <ItemInfo tx={tx} />
      <ItemActions tx={tx} />
    </div>
  );
};

const ItemInfo = ({ tx }: { tx: TransactionListRow }) => {
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
          {(!!tx.has_attachment || tx.description) && (
            <TooltipProvider delay={200}>
              {!!tx.has_attachment && (
                <Tooltip>
                  <TooltipTrigger render={<ImageIcon className="text-muted-foreground size-3.5" />} />
                  <TooltipContent>Ada lampiran foto</TooltipContent>
                </Tooltip>
              )}
              {tx.description && (
                <Tooltip>
                  <TooltipTrigger render={<AlignLeft className="text-muted-foreground size-3.5" />} />
                  <TooltipContent>Ada deskripsi</TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          {formatDate(tx.date, "date-time")}
        </p>
        {tx.note && <p className="text-muted-foreground text-xs">{tx.note}</p>}
      </div>
    </div>
  );
};

const ItemActions = ({ tx }: { tx: TransactionListRow }) => {
  const { deleteTransaction, isDeletingTransaction } = useList();
  const config = typeConfig[tx.type];
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="flex items-center gap-1">
      <p className={`mr-2 font-medium ${config.className}`}>
        {tx.type === "expense" ? "-" : tx.type === "income" ? "+" : ""}
        {formatCurrency(tx.amount, "IDR")}
      </p>
      <ListItemActionsMenu
        actions={[
          { label: "Lihat Detail", icon: Eye, onClick: () => setDetailOpen(true) },
          { label: "Edit", icon: Pencil, onClick: () => setEditOpen(true) },
          {
            label: "Hapus",
            icon: Trash2,
            variant: "destructive",
            onClick: () => setDeleteOpen(true),
          },
        ]}
      />
      <TransactionDetailDialog
        transaction={tx}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={() => setEditOpen(true)}
      />
      <TransactionEditDialog transaction={tx} open={editOpen} onOpenChange={setEditOpen} />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => deleteTransaction(tx.id)}
        isPending={isDeletingTransaction}
        title="Hapus transaksi ini?"
      />
    </div>
  );
};
