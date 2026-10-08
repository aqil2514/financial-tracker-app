"use client";

import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { FormFieldCombobox, FormFieldDate, FormFieldText } from "@/components/forms/form-fields";
import { useAccounts } from "@/features/accounts";
import { formatCurrency } from "@/lib/format-currency";
import { UnitAmountField } from "@/shared/investments/unit-amount-field";
import { useInvestmentHoldingSummary } from "@/shared/investments/use-investment-holding-summary";
import type { WriteOffInvestmentFormOutput, WriteOffInvestmentFormValues } from "./schema";

type WriteOffInvestmentFormProps = {
  form: UseFormReturn<WriteOffInvestmentFormValues, unknown, WriteOffInvestmentFormOutput>;
  onSubmit: (values: WriteOffInvestmentFormOutput) => void;
  isPending: boolean;
  /** true kalau akun investasi sumber sudah terkunci dari konteks
   * pemanggil — pola PERSIS sell-investment-form.tsx. */
  investmentAccountLocked?: boolean;
};

export function WriteOffInvestmentForm({
  form,
  onSubmit,
  isPending,
  investmentAccountLocked = false,
}: WriteOffInvestmentFormProps) {
  const { data: accounts } = useAccounts();
  const investmentAccountId = form.watch("investment_account_id");
  const unit = form.watch("unit");

  const { data: holding } = useInvestmentHoldingSummary(
    investmentAccountId ? String(investmentAccountId) : undefined
  );

  // "Write-off Semua Unit" -- pola PERSIS "Jual Semua Unit" di
  // sell-investment-form.tsx: derived dari field unit itu sendiri (BUKAN
  // state terpisah yang bisa desync), dicek SAMA PERSIS (===) karena
  // holding.remainingUnit di-setValue LANGSUNG sebagai number JS presisi
  // penuh (bukan lewat CurrencyInput yang decimalsLimit={4}).
  const isWritingOffAll =
    holding != null && holding.remainingUnit > 0 && Number(unit) === holding.remainingUnit;

  const investmentAccountOptions =
    accounts
      ?.filter((account) => account.account_type === "investment" && account.is_active)
      .map((account) => ({
        value: String(account.id),
        label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
      })) ?? [];

  // Nominal yang mengurangi balance akun investment = averageCost × unit
  // -- dihitung di sini MURNI untuk preview, sumber kebenaran sebenarnya
  // tetap getAverageCostPerUnit yang dipanggil ULANG saat submit (lihat
  // apply-write-off-investment-transaction.ts), bukan nilai yang di-lock
  // dari preview ini (bisa basi kalau holding berubah antara render dan
  // submit).
  const previewAmount = holding && unit ? holding.averageCostPerUnit * Number(unit) : 0;

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid grid-cols-2 gap-4">
        <FormFieldText form={form} name="note" label="Catatan" placeholder="Mis. Dihibahkan ke teman" />
        <FormFieldDate form={form} name="date" label="Tanggal" />
      </div>
      {!investmentAccountLocked && (
        <FormFieldCombobox
          form={form}
          name="investment_account_id"
          label="Akun Investasi"
          placeholder="Cari akun investasi..."
          options={investmentAccountOptions}
        />
      )}
      {holding && (
        <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 text-sm">
          <p>
            Sisa unit: <span className="font-medium">{holding.remainingUnit}</span>
          </p>
          <p>
            Avg. cost/unit: <span className="font-medium">{formatCurrency(holding.averageCostPerUnit, "IDR")}</span>
          </p>
        </div>
      )}
      {holding && holding.remainingUnit > 0 && (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={isWritingOffAll}
            onCheckedChange={(checked) => {
              // setValue dengan number ASLI dari query (bukan diketik ulang
              // lewat CurrencyInput yang decimalsLimit={4}) -- menghindari
              // sisa unit presisi tinggi terpotong jadi 4 desimal lalu
              // dianggap BEDA dari remainingUnit asli saat validasi oversell
              // (getRemainingUnit, investment-holding-math.ts). Uncheck ->
              // kosongkan lagi supaya user bisa ketik manual lagi, field
              // unit otomatis ikut ENABLED lagi (isWritingOffAll jadi false).
              form.setValue("unit", (checked ? holding.remainingUnit : null) as never, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
          />
          Write-off Semua Unit ({holding.remainingUnit})
        </label>
      )}
      <UnitAmountField
        form={form}
        name="unit"
        optional={false}
        label="Jumlah Unit yang Hilang/Dilepas"
        disabled={isWritingOffAll}
      />
      <p className="text-muted-foreground text-xs">
        Modal yang berkurang dari akun ini: <span className="font-medium">{formatCurrency(previewAmount, "IDR")}</span>{" "}
        (otomatis dari average cost × unit, tidak ada kas yang diterima).
      </p>
      <DialogFooter>
        <Button type="submit" variant="destructive" disabled={isPending}>
          {isPending ? "Menyimpan..." : "Write-off"}
        </Button>
      </DialogFooter>
    </form>
  );
}
