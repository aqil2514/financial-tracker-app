"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import type { Transaction } from "@/lib/db";
import { RichTextViewer } from "@/components/rich-text";
import { AttachmentThumbnail } from "@/features/attachments/attachment-thumbnail";
import { useTransactionAttachments } from "@/features/attachments/use-transaction-attachments";
import { useList } from "./list-context";

/** Tampilan read-only ringkasan transaksi — deskripsi (rich text) dan
 * galeri foto lampiran, dua hal yang tidak muat ditampilkan langsung di
 * card list tapi juga tidak perlu buka form Edit hanya untuk dilihat. */
export function TransactionDetailDialog({
  transaction,
  open,
  onOpenChange,
}: {
  transaction: Transaction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { accountName, categoryName } = useList();
  const { data: attachments } = useTransactionAttachments(
    open ? transaction.id : null
  );

  const description = transaction.description
    ? JSON.parse(transaction.description)
    : null;

  const transactionType =
    transaction.type === "transfer"
      ? `${accountName(transaction.account_id)} → ${accountName(transaction.transfer_account_id)}`
      : accountName(transaction.account_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{transaction.note || "Detail Transaksi"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{transactionType}</span>
            <span className="font-medium">
              {transaction.type === "expense" ? "-" : transaction.type === "income" ? "+" : ""}
              {formatCurrency(transaction.amount, "IDR")}
            </span>
          </div>
          {categoryName(transaction.category_id) && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Kategori</span>
              <span>{categoryName(transaction.category_id)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tanggal</span>
            <span>{formatDate(transaction.date, "date-time")}</span>
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
