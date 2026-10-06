"use client";

import type { UseFormReturn } from "react-hook-form";

import { FormFieldNumber, FormFieldToggleGroup } from "@/components/forms/form-fields";
import { PricePerUnitField } from "@/shared/investments/price-per-unit-field";
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
 *
 * Switch status Pending/Settled (pola sama
 * `shared/investments/new-purchase-form/`) — Pending (default): unit &
 * harga OPSIONAL, boleh dikosongkan kalau order masih diproses dan
 * nilainya belum diketahui pasti, diisi belakangan lewat edit baris di
 * halaman detail investasi. Settled: unit & harga WAJIB (divalidasi di
 * useTransactionInvestmentFields, butuh account type tujuan).
 */
export function InvestmentFields({ form }: InvestmentFieldsProps) {
  const status = form.watch("investment_status");
  const isSettled = status === "settled";

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <FormFieldToggleGroup
        form={form}
        name="investment_status"
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
      <FormFieldNumber
        form={form}
        name="unit"
        label={isSettled ? "Jumlah Unit" : "Jumlah Unit (opsional)"}
        placeholder={isSettled ? "Mis. 66.67" : "Mis. 66.67 — kosongkan kalau belum tahu"}
      />
      <PricePerUnitField form={form} name="price_per_unit" unitFieldName="unit" optional={!isSettled} />
    </div>
  );
}
