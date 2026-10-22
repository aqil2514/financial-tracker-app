"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRetailkuDialog } from "../context";
import { InnerRetailkuPickerProvider, useInnerRetailkuPicker } from "./context";
import { LeftSide } from "./left-side";
import { MappingStep } from "./mapping-step";
import { RightSide } from "./right-side";

export function RetailkuPickerDialog() {
  const { dialog, closeDialog } = useRetailkuDialog();
  const open = dialog?.type === "picker";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeDialog()}>
      <DialogContent className="sm:max-w-7xl!">
        <DialogHeader>
          <DialogTitle>Ambil dari Retailku</DialogTitle>
          <DialogDescription>
            Pilih data dari Retailku untuk diisikan otomatis ke transaksi baru.
          </DialogDescription>
        </DialogHeader>
        <InnerRetailkuPickerProvider>
          <RetailkuPickerSteps />
        </InnerRetailkuPickerProvider>
      </DialogContent>
    </Dialog>
  );
}

function RetailkuPickerSteps() {
  const { step } = useInnerRetailkuPicker();

  if (step === "map") {
    return <MappingStep />;
  }

  return (
    <div className="grid h-128 grid-cols-2 divide-x rounded-lg border">
      <LeftSide />
      <RightSide />
    </div>
  );
}
