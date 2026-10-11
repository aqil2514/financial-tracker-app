"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CategoryPeriod } from "@/lib/db";
import { CategoryContentPeriodForm } from "../form";
import { getCategoryPeriodEditValues } from "../form/schema";
import { usePeriodById } from "../hooks/use-period-by-id";
import { usePeriodCategoryIds } from "../hooks/use-period-category-ids";
import { useUpdateCategoryPeriod } from "../hooks/use-update-category-period";
import { useCategoryPeriodDialog } from "./context";

export function EditPeriodDialog() {
  const { dialog, closeDialog } = useCategoryPeriodDialog();
  const open = dialog?.type === "edit";
  const periodId = open && dialog.dataId ? dialog.dataId : null;

  const { data: period } = usePeriodById(periodId);
  const { data: categoryIds } = usePeriodCategoryIds(periodId);

  if (!open || !period || !categoryIds) return null;

  return (
    <EditPeriodDialogForm
      period={period}
      categoryIds={categoryIds}
      onClose={closeDialog}
    />
  );
}

function EditPeriodDialogForm({
  period,
  categoryIds,
  onClose,
}: {
  period: CategoryPeriod;
  categoryIds: string[];
  onClose: () => void;
}) {
  const mutation = useUpdateCategoryPeriod({ onUpdated: onClose });

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Periode</DialogTitle>
        </DialogHeader>
        <CategoryContentPeriodForm
          defaultValues={getCategoryPeriodEditValues(period, categoryIds)}
          onSubmit={(values) => mutation.mutate({ id: period.id, values })}
          isPending={mutation.isPending}
          submitLabel="Simpan Perubahan"
        />
      </DialogContent>
    </Dialog>
  );
}
