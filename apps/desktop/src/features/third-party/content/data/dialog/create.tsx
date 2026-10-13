"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ThirdPartyFundForm } from "../form";
import {
  defaultThirdPartyFundValues,
  thirdPartyFundSchema,
  type ThirdPartyFundFormOutput,
  type ThirdPartyFundFormValues,
} from "../form/schemas";
import { useThirdPartyDialog } from "./context";

export function ThirdPartyCreateDialog() {
  const { dialog, closeDialog } = useThirdPartyDialog();
  const open = dialog?.type === "create";

  const form = useForm<ThirdPartyFundFormValues, unknown, ThirdPartyFundFormOutput>({
    resolver: zodResolver(thirdPartyFundSchema),
    defaultValues: defaultThirdPartyFundValues(),
  });

  // Submit sementara -- belum disambung ke mutation/DB sungguhan, lihat
  // docs/todos/plan/account-type-third-party.md.
  function onSubmit(values: ThirdPartyFundFormOutput) {
    console.log(values);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeDialog()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Catat Titip/Ambil Dana</DialogTitle>
        </DialogHeader>
        <ThirdPartyFundForm form={form} onSubmit={onSubmit} isPending={false} />
      </DialogContent>
    </Dialog>
  );
}
