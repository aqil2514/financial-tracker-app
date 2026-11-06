"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import type { LabelWithUsage } from "@/shared/labels/use-label-list";
import { useDeleteLabel } from "./use-delete-label";

function describeUsage(label: LabelWithUsage) {
  const parts = [
    label.transaction_count > 0 ? `${label.transaction_count} transaksi` : null,
    label.category_count > 0 ? `${label.category_count} kategori` : null,
    label.account_count > 0 ? `${label.account_count} akun` : null,
  ].filter(Boolean);
  return parts.length > 0
    ? `Label ini akan dilepas dari ${parts.join(", ")}. Datanya sendiri TIDAK ikut terhapus.`
    : "Label ini belum dipakai di mana pun.";
}

export function DeleteLabelDialog({ label }: { label: LabelWithUsage }) {
  const [open, setOpen] = useState(false);
  const deleteLabel = useDeleteLabel();

  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)}>
        <Trash2 className="text-destructive size-4" />
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        onConfirm={() => deleteLabel.mutate(label.id, { onSuccess: () => setOpen(false) })}
        isPending={deleteLabel.isPending}
        title={`Hapus label "${label.name}"?`}
        description={describeUsage(label)}
      />
    </>
  );
}
