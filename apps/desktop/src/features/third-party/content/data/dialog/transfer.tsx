"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ThirdPartyTransferForm } from "../transfer-form";
import {
  defaultThirdPartyTransferValues,
  thirdPartyTransferSchema,
  type ThirdPartyTransferFormOutput,
  type ThirdPartyTransferFormValues,
} from "../transfer-form/schemas";
import { useCreateThirdPartyTransfer } from "../transfer-form/use-create-third-party-transfer";
import { useThirdPartyDialog } from "./context";

export function ThirdPartyTransferDialog() {
  const { dialog, closeDialog } = useThirdPartyDialog();
  const open = dialog?.type === "transfer";

  const form = useForm<ThirdPartyTransferFormValues, unknown, ThirdPartyTransferFormOutput>({
    resolver: zodResolver(thirdPartyTransferSchema),
    defaultValues: defaultThirdPartyTransferValues(),
  });

  const { onSubmit, isPending } = useCreateThirdPartyTransfer({
    onCreated: () => {
      form.reset(defaultThirdPartyTransferValues());
      closeDialog();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeDialog()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pindah Tempat/Kepemilikan Titipan</DialogTitle>
        </DialogHeader>
        <ThirdPartyTransferForm form={form} onSubmit={onSubmit} isPending={isPending} />
      </DialogContent>
    </Dialog>
  );
}
