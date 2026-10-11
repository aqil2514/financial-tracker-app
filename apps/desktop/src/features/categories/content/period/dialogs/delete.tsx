"use client";

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { useDeleteCategoryPeriod } from "../hooks/use-delete-category-period";
import { useCategoryPeriodDialog } from "./context";

export function DeletePeriodDialog() {
  const { dialog, closeDialog } = useCategoryPeriodDialog();
  const open = dialog?.type === "delete";
  const periodId = open && dialog.dataId ? dialog.dataId : null;

  const deletePeriod = useDeleteCategoryPeriod({ onDeleted: closeDialog });

  function handleConfirm() {
    if (periodId == null) return;
    deletePeriod.mutate(periodId);
  }

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={(next) => !next && closeDialog()}
      onConfirm={handleConfirm}
      isPending={deletePeriod.isPending}
      title="Hapus periode ini?"
    />
  );
}
