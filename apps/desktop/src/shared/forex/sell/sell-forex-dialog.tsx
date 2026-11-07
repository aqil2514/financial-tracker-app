"use client";

import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { FormFieldCombobox, FormFieldDate, FormFieldText } from "@/components/forms/form-fields";
import { useAccounts } from "@/features/accounts";
import { formatCurrency } from "@/lib/format-currency";
import { UnitAmountField } from "@/shared/investments/unit-amount-field";
import { formatForexUnit, formatRate } from "../forex-format";
import { RateField } from "../rate-field";
import { useForexAccount } from "../use-forex-account";
import { useForexHoldingSummary } from "../use-forex-queries";
import { useSellForex } from "./use-sell-forex";
import type { SellForexFormOutput, SellForexFormValues } from "./schema";

type Props = { forexAccountId: string; currency: string };

export function SellForexDialog({ forexAccountId, currency }: Props) {
  const { open, setOpen, form, onSubmit, isPending } = useSellForex(forexAccountId);

  return (
    <EntityFormDialog
      trigger={<Button variant="outline">Jual {currency}</Button>}
      title={`Jual ${currency}`}
      open={open}
      onOpenChange={setOpen}
      contentClassName="sm:!max-w-2xl"
    >
      <SellForexForm
        form={form}
        onSubmit={onSubmit}
        isPending={isPending}
        forexAccountId={forexAccountId}
        currency={currency}
      />
    </EntityFormDialog>
  );
}

type FormProps = {
  form: UseFormReturn<SellForexFormValues, unknown, SellForexFormOutput>;
  onSubmit: (values: SellForexFormOutput) => void;
  isPending: boolean;
  forexAccountId: string;
  currency: string;
};

function SellForexForm({ form, onSubmit, isPending, forexAccountId, currency }: FormProps) {
  const { data: accounts } = useAccounts();
  const { data: holding } = useForexHoldingSummary(forexAccountId);
  const { data: forexAccount } = useForexAccount(forexAccountId);

  const unit = Number(form.watch("unit")) || 0;
  const rate = Number(form.watch("rate")) || 0;
  const remainingUnit = holding?.remainingUnit ?? 0;
  const averageCost = holding?.averageCostPerUnit ?? 0;
  const proceeds = unit * rate;
  const estimatedPl = (rate - averageCost) * unit;
  const overSell = unit > remainingUnit;

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
        <FormFieldText form={form} name="note" label="Catatan" placeholder="Mis. Tukar USD ke rupiah" />
        <FormFieldDate form={form} name="date" label="Tanggal" />
      </div>
      <FormFieldCombobox
        form={form}
        name="cash_account_id"
        label="Akun Kas Tujuan"
        placeholder="Cari akun kas..."
        options={cashAccountOptions}
      />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <UnitAmountField form={form} name="unit" label={`Jumlah (${currency})`} optional={false} placeholder="Mis. 50" />
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            disabled={remainingUnit <= 0}
            onClick={() => form.setValue("unit", remainingUnit as never, { shouldValidate: true, shouldDirty: true })}
          >
            Jual semua ({formatForexUnit(remainingUnit, currency)})
          </Button>
        </div>
        <RateField
          form={form}
          name="rate"
          label="Kurs Jual (Rp per 1 unit)"
          description={
            forexAccount && forexAccount.current_rate > 0
              ? `Kurs terkini tersimpan: ${formatRate(forexAccount.current_rate)}`
              : undefined
          }
        />
      </div>
      <div className="text-muted-foreground space-y-1 text-xs">
        <p>
          Sisa {formatForexUnit(remainingUnit, currency)}, average cost {formatRate(averageCost)} per unit.
        </p>
        {unit > 0 && rate > 0 && !overSell && (
          <p>
            Rupiah diterima {formatCurrency(proceeds, "IDR")}, laba/rugi kurs{" "}
            <span className={estimatedPl >= 0 ? "text-green-600" : "text-red-600"}>
              {estimatedPl >= 0 ? "+" : ""}
              {formatCurrency(estimatedPl, "IDR")}
            </span>
            .
          </p>
        )}
        {overSell && <p className="text-destructive">Jumlah melebihi sisa yang dimiliki.</p>}
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isPending || overSell}>
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </DialogFooter>
    </form>
  );
}
