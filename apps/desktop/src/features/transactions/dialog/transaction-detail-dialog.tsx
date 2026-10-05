"use client";

import { Pencil } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import type { Transaction } from "@/lib/db";
import { RichTextViewer } from "@/components/rich-text";
import { AttachmentThumbnail } from "@/shared/attachments/attachment-thumbnail";
import { useTransactionAttachments } from "@/shared/attachments/use-transaction-attachments";
import { useContacts } from "@/features/contacts";
import { useAccounts } from "@/features/accounts";
import { useCategories } from "@/features/categories";
import { DEBT_STATUS_LABEL, DEBT_STATUS_VARIANT } from "@/shared/debts/status-labels";
import { useRelatedDebt } from "@/shared/debts/use-related-debt";
import { typeConfig } from "../shared/constants";
import { useTransactionById } from "../shared/hooks/use-transaction-by-id";
import { accountNameParts } from "../shared/utils/account-name";
import { categoryName } from "../shared/utils/category-name";
import { useTransactionsDialog } from "./context";

export function TransactionDetailDialog() {
  const { dialog, closeDialog, openDialog } = useTransactionsDialog();
  const open = dialog?.type === "detail";
  const transactionId = open && dialog.dataId ? dialog.dataId : null;

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
  const { data: contacts } = useContacts();
  const { data: attachments } = useTransactionAttachments(transaction.id);
  const { data: relatedDebt } = useRelatedDebt(transaction.id);

  const description = transaction.description
    ? JSON.parse(transaction.description)
    : null;

  const contact = contacts?.find((contact) => contact.id === transaction.contact_id);

  const config = typeConfig[transaction.type];
  const Icon = config.icon;

  const fromAccount = accountNameParts(accounts, transaction.account_id);
  const toAccount =
    transaction.type === "transfer"
      ? accountNameParts(accounts, transaction.transfer_account_id)
      : null;
  const accountLine = toAccount ? `${fromAccount.name} → ${toAccount.name}` : fromAccount.name;
  const accountGroups = [...new Set([fromAccount.group, toAccount?.group].filter(Boolean))] as string[];

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
            <div className="flex items-start justify-between gap-4">
              <span className="text-muted-foreground shrink-0">Akun</span>
              <div className="flex flex-col items-end gap-1">
                <span className="font-medium text-right">{accountLine}</span>
                {accountGroups.length > 0 && (
                  <div className="flex flex-wrap justify-end gap-1">
                    {accountGroups.map((group) => (
                      <Badge key={group} variant="outline" className="text-muted-foreground">
                        {group}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {categoryName(categories, transaction.category_id) && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Kategori</span>
                <Badge variant="secondary">{categoryName(categories, transaction.category_id)}</Badge>
              </div>
            )}
            {contact && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Kontak</span>
                <span className="font-medium">{contact.name}</span>
              </div>
            )}
            {relatedDebt && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {relatedDebt.role === "principal" ? "Mencatat" : "Membayar"}{" "}
                  {relatedDebt.debt.type === "receivable" ? "Piutang" : "Utang"}
                </span>
                <Badge variant={DEBT_STATUS_VARIANT[relatedDebt.debt.status]}>
                  {DEBT_STATUS_LABEL[relatedDebt.debt.status]}
                </Badge>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tanggal</span>
              <span>{formatDate(transaction.date, "date-time")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Dicatat</span>
              <span className="text-muted-foreground text-xs">
                {formatDate(transaction.created_at, "date-time")}
              </span>
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
