"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";

import { formatCurrency } from "@/lib/format-currency";
import { ListItemActionsMenu } from "@/components/list-item-actions-menu";
import { useTransactionsDialog } from "../../../../dialog";
import { typeConfig } from "../../../../shared/constants";
import type { TransactionListRow } from "../../use-transactions";

export const ItemActions = ({ tx }: { tx: TransactionListRow }) => {
  const { openDialog } = useTransactionsDialog();
  const config = typeConfig[tx.type];

  return (
    <div className="flex items-center gap-1">
      <p className={`mr-2 font-medium ${config.className}`}>
        {tx.type === "expense" ? "-" : tx.type === "income" ? "+" : ""}
        {formatCurrency(tx.amount, "IDR")}
      </p>
      <ListItemActionsMenu
        actions={[
          { label: "Lihat Detail", icon: Eye, onClick: () => openDialog("detail", String(tx.id)) },
          { label: "Edit", icon: Pencil, onClick: () => openDialog("edit", String(tx.id)) },
          {
            label: "Hapus",
            icon: Trash2,
            variant: "destructive",
            onClick: () => openDialog("delete-confirm", String(tx.id)),
          },
        ]}
      />
    </div>
  );
};
