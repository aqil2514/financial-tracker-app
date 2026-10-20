"use client";

import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { FormFieldCurrency, FormFieldDate, FormFieldText } from "@/components/forms/form-fields";
import { formatCurrency } from "@/lib/format-currency";
import type { DebtListRow } from "@/shared/debts/use-debts-list";
import type { CorrectDebtRemainingFormOutput, CorrectDebtRemainingFormValues } from "./schema";

type CorrectDebtRemainingFormProps = {
  debt: DebtListRow;
  form: UseFormReturn<CorrectDebtRemainingFormValues, unknown, CorrectDebtRemainingFormOutput>;
  onSubmit: (values: CorrectDebtRemainingFormOutput) => void;
  isPending: boolean;
};

export function CorrectDebtRemainingForm({ debt, form, onSubmit, isPending }: CorrectDebtRemainingFormProps) {
  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <p className="text-muted-foreground text-sm">
        {debt.contact_name ?? "—"} · Sisa tercatat saat ini {formatCurrency(debt.remaining, "IDR")}
      </p>
      <FormFieldCurrency form={form} name="targetRemaining" label="Sisa yang Seharusnya" useCalculator />
      <FormFieldDate form={form} name="date" label="Tanggal" />
      <FormFieldText
        form={form}
        name="note"
        label="Catatan"
        placeholder="Mis. Koreksi salah catat nominal awal"
      />
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </DialogFooter>
    </form>
  );
}
