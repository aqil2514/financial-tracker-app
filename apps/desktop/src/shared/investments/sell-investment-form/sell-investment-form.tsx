"use client";

import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  FormFieldCombobox,
  FormFieldDate,
  FormFieldText,
  FormFieldToggleGroup,
} from "@/components/forms/form-fields";
import { useAccounts } from "@/features/accounts";
import { formatCurrency } from "@/lib/format-currency";
import { PricePerUnitField } from "@/shared/investments/price-per-unit-field";
import { UnitAmountField } from "@/shared/investments/unit-amount-field";
import { useInvestmentHoldingSummary } from "@/shared/investments/use-investment-holding-summary";
import type { SellInvestmentFormOutput, SellInvestmentFormValues } from "./schema";

type SellInvestmentFormProps = {
  form: UseFormReturn<SellInvestmentFormValues, unknown, SellInvestmentFormOutput>;
  onSubmit: (values: SellInvestmentFormOutput) => void;
  isPending: boolean;
  /** true kalau akun investasi sumber sudah terkunci dari konteks
   * pemanggil (lihat useCreateInvestmentSale) — pola PERSIS
   * new-investment-purchase-form.tsx. */
  investmentAccountLocked?: boolean;
};

export function SellInvestmentForm({
  form,
  onSubmit,
  isPending,
  investmentAccountLocked = false,
}: SellInvestmentFormProps) {
  const { data: accounts } = useAccounts();
  const investmentAccountId = form.watch("investment_account_id");
  const unit = form.watch("unit");
  const pricePerUnit = form.watch("price_per_unit");
  const status = form.watch("status");
  const isSettled = status === "settled";

  const { data: holding } = useInvestmentHoldingSummary(
    investmentAccountId ? String(investmentAccountId) : undefined
  );

  const cashAccountOptions =
    accounts
      ?.filter((account) => account.account_type === "cash" && account.is_active)
      .map((account) => ({
        value: String(account.id),
        label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
      })) ?? [];

  const investmentAccountOptions =
    accounts
      ?.filter((account) => account.account_type === "investment" && account.is_active)
      .map((account) => ({
        value: String(account.id),
        label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
      })) ?? [];

  // Nominal transfer (uang yang BENAR-benar masuk ke kas) = unit * harga
  // jual per unit, dihitung otomatis -- lihat schema.ts + komentar di
  // use-create-investment-sale.ts soal kenapa field ini read-only (bukan
  // manual seperti form beli): balance akun investment harus berkurang
  // sebesar average cost (bukan nominal ini), jadi field ini MURNI
  // informasi "uang yang akan diterima", tidak pernah jadi sumber
  // kebenaran utk balance yang disimpan ke transactions.amount.
  const displayAmount = unit && pricePerUnit ? Number(unit) * Number(pricePerUnit) : 0;

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid grid-cols-2 gap-4">
        <FormFieldText form={form} name="note" label="Catatan" placeholder="Mis. Jual sebagian reksadana" />
        <FormFieldDate form={form} name="date" label="Tanggal" />
      </div>
      <FormFieldToggleGroup
        form={form}
        name="status"
        label="Status"
        description={
          isSettled
            ? "Nilainya sudah pasti saat ini."
            : "Order masih diproses -- unit sudah dikurangi dari saldo sekarang (optimis), bisa diubah ke Settled belakangan."
        }
        options={[
          { value: "pending", label: "Pending" },
          { value: "settled", label: "Settled" },
        ]}
      />
      <div className={investmentAccountLocked ? "" : "grid grid-cols-2 gap-4"}>
        {!investmentAccountLocked && (
          <FormFieldCombobox
            form={form}
            name="investment_account_id"
            label="Akun Investasi"
            placeholder="Cari akun investasi..."
            options={investmentAccountOptions}
          />
        )}
        <FormFieldCombobox
          form={form}
          name="cash_account_id"
          label="Akun Kas"
          placeholder="Cari akun kas..."
          options={cashAccountOptions}
        />
      </div>
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
      <div className="grid grid-cols-2 gap-4">
        <UnitAmountField form={form} name="unit" optional={false} />
        <PricePerUnitField
          form={form}
          name="price_per_unit"
          unitFieldName="unit"
          label="Harga Jual per Unit"
          optional={false}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        Nominal yang masuk ke akun kas: <span className="font-medium">{formatCurrency(displayAmount, "IDR")}</span>{" "}
        (otomatis dari unit × harga jual).
      </p>
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </DialogFooter>
    </form>
  );
}
