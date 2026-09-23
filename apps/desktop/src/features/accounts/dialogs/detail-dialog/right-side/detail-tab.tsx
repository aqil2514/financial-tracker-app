"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownCircle, ArrowLeftRight, ArrowUpCircle, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { useAccounts } from "@/hooks/resources/use-accounts";
import { useCategories } from "@/features/categories";
import { RichTextViewer } from "@/components/rich-text";
import { AttachmentThumbnail } from "@/shared/attachments/attachment-thumbnail";
import { useTransactionAttachments } from "@/shared/attachments/use-transaction-attachments";
import { useDeleteTransaction } from "@/features/transactions";
import { useAccountDetail } from "../detail-context";
import { useTransactionById } from "./use-transaction-by-id";

const typeConfig = {
  income: { icon: ArrowUpCircle, label: "Pemasukan", className: "text-green-600" },
  expense: { icon: ArrowDownCircle, label: "Pengeluaran", className: "text-red-600" },
  transfer: { icon: ArrowLeftRight, label: "Transfer", className: "text-blue-600" },
};

/** Detail transaksi yang dipilih dari tab Terbaru/Bulan Ini, disusun
 * sebagai kartu ringkasan (ikon + nominal besar di atas) — kosong dengan
 * pesan penuntun kalau belum ada transaksi yang dipilih. */
export function DetailTab() {
  const router = useRouter();
  const { selectedTransactionId, closeParentDialog, setActiveTab } = useAccountDetail();
  const { data: transaction } = useTransactionById(selectedTransactionId);
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { data: attachments } = useTransactionAttachments(selectedTransactionId);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteTransaction = useDeleteTransaction();

  function handleEdit() {
    if (!selectedTransactionId) return;
    closeParentDialog();
    router.push(`/transactions?edit=${selectedTransactionId}`);
  }

  function handleDelete() {
    if (!selectedTransactionId) return;
    deleteTransaction.mutate(selectedTransactionId, {
      onSuccess: () => {
        setDeleteOpen(false);
        setActiveTab("recent");
      },
    });
  }

  const accountName = (id: number | null) =>
    accounts?.find((account) => account.id === id)?.name ?? "-";

  const categoryName = (id: number | null) =>
    categories?.find((category) => category.id === id)?.name ?? null;

  if (!selectedTransactionId || !transaction) {
    return (
      <p className="text-muted-foreground flex h-40 items-center justify-center text-center text-sm">
        Pilih transaksi dari tab Terbaru atau Bulan Ini untuk melihat detailnya.
      </p>
    );
  }

  const description = transaction.description ? JSON.parse(transaction.description) : null;
  const config = typeConfig[transaction.type];
  const Icon = config.icon;

  const transactionType =
    transaction.type === "transfer"
      ? `${accountName(transaction.account_id)} → ${accountName(transaction.transfer_account_id)}`
      : accountName(transaction.account_id);

  return (
    <div className="space-y-6 text-sm">
      {/* Kartu ringkasan: ikon, nominal besar, tipe */}
      <div className="relative flex flex-col items-center gap-2 rounded-lg border p-6 text-center">
        <div className="absolute top-3 right-3 flex gap-2">
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Pencil className="size-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            Hapus
          </Button>
        </div>
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
          <span className="font-medium text-right">{transactionType}</span>
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

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        isPending={deleteTransaction.isPending}
        title="Hapus transaksi ini?"
        description="Tindakan ini tidak bisa dibatalkan. Saldo akun akan otomatis menyesuaikan."
      />
    </div>
  );
}
