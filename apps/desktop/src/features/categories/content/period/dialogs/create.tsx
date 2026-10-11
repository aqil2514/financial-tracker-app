"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CategoryContentPeriodForm } from "../form";
import { useCreateCategoryPeriod } from "../hooks/use-create-category-period";
import { getCategoryPeriodDefaultValues } from "../form/schema";
import { useCategoryPeriodDialog } from "./context";

export function CreateCategoryPeriodDialog() {
  const { dialog, openDialog, closeDialog } = useCategoryPeriodDialog();
  const mutation = useCreateCategoryPeriod({
    onCreated: () => closeDialog(),
  });

  return (
    <Dialog
      open={dialog?.type === "create"}
      onOpenChange={(open) => (open ? openDialog("create") : closeDialog())}
    >
      <DialogTrigger render={<Button size="sm">Tambah Periode</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Periode</DialogTitle>
        </DialogHeader>
        <CategoryContentPeriodForm
          defaultValues={getCategoryPeriodDefaultValues()}
          onSubmit={(values) => mutation.mutate(values)}
          isPending={mutation.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
