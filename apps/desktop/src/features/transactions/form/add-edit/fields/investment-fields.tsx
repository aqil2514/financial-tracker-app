"use client";

import type { UseFormReturn } from "react-hook-form";

import { FormFieldNumber } from "@/components/forms/form-fields";
import type { TransactionFormOutput, TransactionFormValues } from "../schema";

type InvestmentFieldsProps = {
  form: UseFormReturn<TransactionFormValues, unknown, TransactionFormOutput>;
};

/**
 * Muncul begitu transfer tujuannya akun `account_type='investment'`
 * (lihat useTransactionInvestmentFields) — unit & harga per unit MANUAL,
 * independen satu sama lain dan dari nominal transfer (TIDAK divalidasi
 * harus sama), lihat docs/concept/konsep-investasi.md bagian "Unit dan
 * harga per unit".
 */
export function InvestmentFields({ form }: InvestmentFieldsProps) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <FormFieldNumber form={form} name="unit" label="Jumlah Unit" placeholder="Mis. 66.67" />
      <FormFieldNumber
        form={form}
        name="price_per_unit"
        label="Harga per Unit saat ini"
        placeholder="Mis. 1500"
      />
    </div>
  );
}
