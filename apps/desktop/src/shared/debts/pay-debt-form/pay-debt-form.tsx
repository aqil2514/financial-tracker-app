"use client";

import { useWatch, type UseFormReturn } from "react-hook-form";

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
import { formatCurrency } from "@/lib/format-currency";
import type { DebtListRow } from "@/shared/debts/use-debts-list";
import type { PayDebtFormOutput, PayDebtFormValues } from "./schema";

type PayDebtFormProps = {
  debt: DebtListRow;
  form: UseFormReturn<PayDebtFormValues, unknown, PayDebtFormOutput>;
  onSubmit: (values: PayDebtFormOutput) => void;
  isPending: boolean;
};

const settlementModeOptions = [
  { value: "cash", label: "Dengan Uang" },
  { value: "non_cash", label: "Tanpa Uang" },
];

export function PayDebtForm({ debt, form, onSubmit, isPending }: PayDebtFormProps) {
  const { data: accounts } = useAccounts();

  const settlementMode = useWatch({ control: form.control, name: "settlement_mode" });

  const cashAccountOptions =
    accounts
      ?.filter((account) => account.account_type === "cash" && account.is_active)
      .map((account) => ({
        value: String(account.id),
        label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
      })) ?? [];

  function handleSubmit(values: PayDebtFormOutput) {
    if (values.amount > debt.remaining) {
      form.setError("amount", {
        message: "Nominal melebihi sisa — catat kelebihannya sebagai transaksi terpisah",
      });
      return;
    }
    onSubmit(values);
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
      <p className="text-muted-foreground text-sm">
        {debt.contact_name ?? "—"} · Sisa {formatCurrency(debt.remaining, "IDR")}
      </p>
      <FormFieldToggleGroup
        form={form}
        name="settlement_mode"
        label="Cara Menyelesaikan"
        description={
          settlementMode === "non_cash"
            ? "Tidak ada uang yang berpindah (dibayar barang/jasa, dihapuskan, atau dikompensasi) — jelaskan alasannya di Catatan."
            : "Uang riil berpindah lewat akun kas."
        }
        options={settlementModeOptions}
      />
      <FormFieldCurrency
        form={form}
        name="amount"
        label={settlementMode === "non_cash" ? "Nominal Diselesaikan" : "Nominal Dibayar"}
        useCalculator
      />
      {settlementMode === "cash" && (
        <FormFieldCombobox
          form={form}
          name="cash_account_id"
          label="Akun Kas"
          placeholder="Cari akun kas..."
          options={cashAccountOptions}
        />
      )}
      <FormFieldDate form={form} name="date" label="Tanggal" />
      <FormFieldText
        form={form}
        name="note"
        label="Catatan"
        placeholder={
          settlementMode === "non_cash" ? "Mis. Dihapuskan, tidak sanggup bayar" : "Mis. Cicilan pertama"
        }
      />
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </DialogFooter>
    </form>
  );
}
