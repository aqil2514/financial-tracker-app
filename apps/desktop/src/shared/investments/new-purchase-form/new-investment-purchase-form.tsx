"use client";

import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  FormFieldCombobox,
  FormFieldCurrency,
  FormFieldDate,
  FormFieldText,
  FormFieldToggleGroup,
} from "@/components/forms/form-fields";
import { useAccounts } from "@/features/accounts";
import { PricePerUnitField } from "@/shared/investments/price-per-unit-field";
import { UnitAmountField } from "@/shared/investments/unit-amount-field";
import type { NewInvestmentPurchaseFormOutput, NewInvestmentPurchaseFormValues } from "./schema";

type NewInvestmentPurchaseFormProps = {
  form: UseFormReturn<NewInvestmentPurchaseFormValues, unknown, NewInvestmentPurchaseFormOutput>;
  onSubmit: (values: NewInvestmentPurchaseFormOutput) => void;
  isPending: boolean;
  /** true kalau akun investasi tujuan sudah terkunci dari konteks
   * pemanggil (lihat useCreateInvestmentPurchase) — combobox "Akun
   * Investasi" disembunyikan, user cuma perlu isi sisanya. */
  investmentAccountLocked?: boolean;
};

export function NewInvestmentPurchaseForm({
  form,
  onSubmit,
  isPending,
  investmentAccountLocked = false,
}: NewInvestmentPurchaseFormProps) {
  const { data: accounts } = useAccounts();
  const status = form.watch("status");
  const isSettled = status === "settled";

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

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <FormFieldText form={form} name="note" label="Catatan" placeholder="Mis. Beli reksadana rutin" />
      <FormFieldDate form={form} name="date" label="Tanggal" />
      <FormFieldToggleGroup
        form={form}
        name="status"
        label="Status"
        description={
          isSettled
            ? "Nilainya sudah pasti saat ini — jumlah unit & harga per unit wajib diisi."
            : "Order masih diproses, unit & harga final belum diketahui — boleh dikosongkan dulu, isi belakangan lewat edit baris di riwayat pembelian."
        }
        options={[
          { value: "pending", label: "Pending" },
          { value: "settled", label: "Settled" },
        ]}
      />
      <FormFieldCombobox
        form={form}
        name="cash_account_id"
        label="Akun Kas"
        placeholder="Cari akun kas..."
        options={cashAccountOptions}
      />
      {!investmentAccountLocked && (
        <FormFieldCombobox
          form={form}
          name="investment_account_id"
          label="Akun Investasi"
          placeholder="Cari akun investasi..."
          options={investmentAccountOptions}
        />
      )}
      <div className="space-y-1">
        <FormFieldCurrency form={form} name="amount" label="Nominal" useCalculator />
        <p className="text-muted-foreground text-xs">Uang yang keluar dari akun kas saat ini.</p>
      </div>
      <UnitAmountField form={form} name="unit" optional={!isSettled} />
      <PricePerUnitField form={form} name="price_per_unit" unitFieldName="unit" optional={!isSettled} />
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </DialogFooter>
    </form>
  );
}
