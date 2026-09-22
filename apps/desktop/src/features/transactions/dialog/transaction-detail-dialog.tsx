"use client";

import { ArrowDownCircle, ArrowLeftRight, ArrowUpCircle, Pencil } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import type { Transaction } from "@/lib/db";
import { RichTextViewer } from "@/components/rich-text";
import { AttachmentThumbnail } from "@/shared/attachments/attachment-thumbnail";
import { useTransactionAttachments } from "@/shared/attachments/use-transaction-attachments";
import { useAccounts } from "@/features/accounts";
import { useCategories } from "@/features/categories";
import { useTransactionById } from "../shared/use-transaction-by-id";
import { useTransactionsDialog } from "./context";

const typeConfig = {
  income: { icon: ArrowUpCircle, label: "Pemasukan", className: "text-green-600" },
  expense: { icon: ArrowDownCircle, label: "Pengeluaran", className: "text-red-600" },
  transfer: { icon: ArrowLeftRight, label: "Transfer", className: "text-blue-600" },
};

export function TransactionDetailDialog() {
  const { dialog, closeDialog, openDialog } = useTransactionsDialog();
  const open = dialog?.type === "detail";
  const transactionId = open && dialog.dataId ? Number(dialog.dataId) : null;

  const { data: transaction } = useTransactionById(transactionId);

  if (!open || !transaction) return null;

  function handleEdit() {
    if (!transaction) return;
    openDialog("edit", String(transaction.id));
  }

  return (
    <TransactionDetailDialogContent
      transaction={transaction}
      onOpenChange={(next) => !next && closeDialog()}
      onEdit={handleEdit}
    />
  );
}

/** Tampilan read-only ringkasan transaksi — kartu visual besar (ikon +
 * nominal) di atas, lalu detail Akun/Kategori/Tanggal, lampiran foto, dan
 * deskripsi (rich text) di bawahnya. Tombol Edit membuka dialog edit
 * (context "edit") tanpa navigasi halaman. */
function TransactionDetailDialogContent({
  transaction,
  onOpenChange,
  onEdit,
}: {
  transaction: Transaction;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}) {
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { data: attachments } = useTransactionAttachments(transaction.id);

  function accountName(id: number | null) {
    return accounts?.find((account) => account.id === id)?.name ?? "-";
  }

  function categoryName(id: number | null) {
    return categories?.find((category) => category.id === id)?.name ?? null;
  }

  const description = transaction.description
    ? JSON.parse(transaction.description)
    : null;

  const config = typeConfig[transaction.type];
  const Icon = config.icon;

  const transactionType =
    transaction.type === "transfer"
      ? `${accountName(transaction.account_id)} → ${accountName(transaction.transfer_account_id)}`
      : accountName(transaction.account_id);

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detail Transaksi</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          <div className="relative flex flex-col items-center gap-2 rounded-lg border p-6 text-center">
            <Button
              variant="outline"
              size="sm"
              className="absolute top-3 right-3"
              onClick={onEdit}
            >
              <Pencil className="size-4" />
              Edit
            </Button>
            <Icon className={`size-10 ${config.className}`} />
            <p className={`text-2xl font-semibold ${config.className}`}>
              {transaction.type === "expense" ? "-" : transaction.type === "income" ? "+" : ""}
              {formatCurrency(transaction.amount, "IDR")}
            </p>
            <p className="text-muted-foreground">{config.label}</p>
            <p className="font-medium">{transaction.note || "Tanpa catatan"}</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Akun</span>
              <span className="font-medium">{transactionType}</span>
            </div>
            {categoryName(transaction.category_id) && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Kategori</span>
                <Badge variant="secondary">{categoryName(transaction.category_id)}</Badge>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tanggal</span>
              <span>{formatDate(transaction.date, "date-time")}</span>
            </div>
          </div>

          {attachments && attachments.length > 0 && (
            <div className="space-y-2">
              <p className="text-muted-foreground">Lampiran Foto</p>
              <div className="flex flex-wrap gap-2">
                {attachments.map((attachment) => (
                  <AttachmentThumbnail key={attachment.id} attachment={attachment} />
                ))}
              </div>
            </div>
          )}

          {description && (
            <div className="space-y-2">
              <p className="text-muted-foreground">Deskripsi</p>
              <RichTextViewer value={description} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
