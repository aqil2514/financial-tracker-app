"use client";

import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import {
  FormFieldCombobox,
  FormFieldDate,
  FormFieldText,
  FormFieldToggleGroup,
} from "@/components/forms/form-fields";
import { useAccounts } from "@/features/accounts";
import { formatCurrency } from "@/lib/format-currency";
import { UnitAmountField } from "@/shared/investments/unit-amount-field";
import { RateField } from "../rate-field";
import { useCreateForexPurchase } from "./use-create-forex-purchase";
import type { NewForexPurchaseFormOutput, NewForexPurchaseFormValues } from "./schema";

type Props = { forexAccountId: string; currency: string };

export function NewForexPurchaseDialog({ forexAccountId, currency }: Props) {
  const { open, setOpen, form, onSubmit, isPending } = useCreateForexPurchase(forexAccountId);

  return (
    <EntityFormDialog
      trigger={<Button>Catat Pembelian</Button>}
      title={`Catat Pembelian ${currency}`}
      open={open}
      onOpenChange={setOpen}
      contentClassName="sm:!max-w-2xl"
    >
      <NewForexPurchaseForm form={form} onSubmit={onSubmit} isPending={isPending} currency={currency} />
    </EntityFormDialog>
  );
}

type FormProps = {
  form: UseFormReturn<NewForexPurchaseFormValues, unknown, NewForexPurchaseFormOutput>;
  onSubmit: (values: NewForexPurchaseFormOutput) => void;
  isPending: boolean;
  currency: string;
};

function NewForexPurchaseForm({ form, onSubmit, isPending, currency }: FormProps) {
  const { data: accounts } = useAccounts();
  const source = form.watch("source");
  const unit = Number(form.watch("unit")) || 0;
  const rate = Number(form.watch("rate")) || 0;

  const cashAccountOptions =
    accounts
      ?.filter((account) => account.account_type === "cash" && account.is_active)
      .map((account) => ({
        value: String(account.id),
        label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
      })) ?? [];

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid grid-cols-2 gap-4">
        <FormFieldText form={form} name="note" label="Catatan" placeholder="Mis. Beli USD di myBCA" />
        <FormFieldDate form={form} name="date" label="Tanggal" />
      </div>
      <FormFieldToggleGroup
        form={form}
        name="source"
        label="Sumber Dana"
        description={
          source === "cash"
            ? "Rupiah keluar dari akun kas yang dipilih."
            : "Tanpa akun kas: untuk valas yang sudah dipegang sebelum memakai aplikasi, atau yang sumber rupiahnya tidak dilacak. Saldo kas tidak berubah."
        }
        options={[
          { value: "cash", label: "Dari akun kas" },
          { value: "direct", label: "Tanpa akun kas" },
        ]}
      />
      {source === "cash" && (
        <FormFieldCombobox
          form={form}
          name="cash_account_id"
          label="Akun Kas"
          placeholder="Cari akun kas..."
          options={cashAccountOptions}
        />
      )}
      <div className="grid grid-cols-2 gap-4">
        <UnitAmountField form={form} name="unit" label={`Jumlah (${currency})`} optional={false} placeholder="Mis. 100" />
        <RateField form={form} name="rate" label="Kurs Beli (Rp per 1 unit)" />
      </div>
      <p className="text-muted-foreground text-xs">
        Nominal rupiah = jumlah × kurs
        {unit > 0 && rate > 0 ? `: ${formatCurrency(unit * rate, "IDR")}` : ""}. Isi kurs dengan kurs yang
        benar-benar dibayar. Biaya admin bank, kalau ada, dicatat sebagai pengeluaran terpisah.
      </p>
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </DialogFooter>
    </form>
  );
}
