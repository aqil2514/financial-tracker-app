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

const recordModeOptions = [
  { value: "transfer", label: "Dengan Transfer Kas" },
  { value: "direct", label: "Langsung (hibah/bonus/saldo awal)" },
];

export function NewInvestmentPurchaseForm({
  form,
  onSubmit,
  isPending,
  investmentAccountLocked = false,
}: NewInvestmentPurchaseFormProps) {
  const { data: accounts } = useAccounts();
  const recordMode = form.watch("record_mode");
  const status = form.watch("status");
  const isDirect = recordMode === "direct";
  const isSettled = isDirect || status === "settled";

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
      <div className="grid grid-cols-2 gap-4">
        <FormFieldText form={form} name="note" label="Catatan" placeholder="Mis. Beli reksadana rutin" />
        <FormFieldDate form={form} name="date" label="Tanggal" />
      </div>
      <FormFieldToggleGroup
        form={form}
        name="record_mode"
        label="Cara Mencatat"
        description={
          isDirect
            ? "Unit bertambah tanpa transfer kas (hibah, bonus saham, right issue, atau saldo & unit awal sebelum pakai app) — tidak menyentuh saldo akun kas manapun."
            : "Mencatat lewat transaksi transfer kas -> akun investasi, saldo akun kas ikut berkurang."
        }
        options={recordModeOptions}
      />
      {!isDirect && (
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
      )}
      <div className={!isDirect && !investmentAccountLocked ? "grid grid-cols-2 gap-4" : ""}>
        {!isDirect && (
          <FormFieldCombobox
            form={form}
            name="cash_account_id"
            label="Akun Kas"
            placeholder="Cari akun kas..."
            options={cashAccountOptions}
          />
        )}
        {!investmentAccountLocked && (
          <FormFieldCombobox
            form={form}
            name="investment_account_id"
            label="Akun Investasi"
            placeholder="Cari akun investasi..."
            options={investmentAccountOptions}
          />
        )}
      </div>
      <div className="space-y-1">
        <FormFieldCurrency form={form} name="amount" label="Nominal" useCalculator />
        <p className="text-muted-foreground text-xs">
          {isDirect
            ? "Nilai yang diakui sebagai modal (boleh 0 untuk hibah murni tanpa nilai yang mau diakui) — tidak ada kas yang keluar."
            : "Uang yang keluar dari akun kas saat ini."}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <UnitAmountField form={form} name="unit" optional={!isSettled} />
        <PricePerUnitField form={form} name="price_per_unit" unitFieldName="unit" optional={!isSettled} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </DialogFooter>
    </form>
  );
}
