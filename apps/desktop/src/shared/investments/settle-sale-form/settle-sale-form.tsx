"use client";

import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { FormFieldCombobox } from "@/components/forms/form-fields";
import { useAccounts } from "@/features/accounts";
import { formatCurrency } from "@/lib/format-currency";
import type { InvestmentSaleRow } from "@/shared/investments/use-investment-sales";
import type { SettleSaleFormOutput, SettleSaleFormValues } from "./schema";

type SettleSaleFormProps = {
  sale: InvestmentSaleRow;
  form: UseFormReturn<SettleSaleFormValues, unknown, SettleSaleFormOutput>;
  onSubmit: (values: SettleSaleFormOutput) => void;
  isPending: boolean;
};

/** Pilih akun kas tujuan untuk men-settle satu baris penjualan pending —
 * unit & harga jual ditampilkan read-only (sudah terkunci sejak create,
 * TIDAK bisa diubah di sini), average cost & Realized P/L BARU dihitung
 * setelah submit (lihat use-settle-investment-sale.ts). */
export function SettleSaleForm({ sale, form, onSubmit, isPending }: SettleSaleFormProps) {
  const { data: accounts } = useAccounts();

  const cashAccountOptions =
    accounts
      ?.filter((account) => account.account_type === "cash" && account.is_active)
      .map((account) => ({
        value: String(account.id),
        label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
      })) ?? [];

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 text-sm">
        <p>
          Unit dijual: <span className="font-medium">{sale.unit}</span>
        </p>
        <p>
          Harga jual/unit: <span className="font-medium">{formatCurrency(sale.price_per_unit, "IDR")}</span>
        </p>
      </div>
      <FormFieldCombobox
        form={form}
        name="cash_account_id"
        label="Akun Kas Tujuan"
        placeholder="Cari akun kas..."
        options={cashAccountOptions}
      />
      <p className="text-muted-foreground text-xs">
        Average cost & Realized P/L dihitung dari kondisi SAAT INI begitu disettle, lalu disimpan permanen.
      </p>
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Men-settle..." : "Settle"}
        </Button>
      </DialogFooter>
    </form>
  );
}
