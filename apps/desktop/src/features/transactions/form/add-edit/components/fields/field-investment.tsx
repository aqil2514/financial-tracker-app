"use client";

import { useEffect } from "react";

import { FormFieldToggleGroup } from "@/components/forms/form-fields";
import { formatCurrency } from "@/lib/format-currency";
import { PricePerUnitField } from "@/shared/investments/price-per-unit-field";
import { UnitAmountField } from "@/shared/investments/unit-amount-field";
import { useInvestmentHoldingSummary } from "@/shared/investments/use-investment-holding-summary";
import { useTransactionFormFields } from "../../context/transaction-form-fields-context";

export function FieldInvestment() {
  const {
    form,
    accountId,
    needsInvestmentFields,
    needsInvestmentSellFields,
    needsInvestmentDirectBuyFields,
    needsInvestmentWriteOffFields,
  } = useTransactionFormFields();
  const isSell = needsInvestmentSellFields;
  const isWriteOff = needsInvestmentWriteOffFields;
  const isDirectBuy = needsInvestmentDirectBuyFields;
  const needsHoldingSummary = isSell || isWriteOff;
  const investmentAccountId = needsHoldingSummary ? accountId : undefined;

  const status = form.watch("investment_status");
  const isSettled = isSell || isWriteOff || isDirectBuy ? true : status === "settled";
  const fieldsOptional = !isSell && !isWriteOff && !isDirectBuy && !isSettled;

  useEffect(() => {
    if (isSell || isDirectBuy) form.setValue("investment_status", "settled", { shouldValidate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSell, isDirectBuy]);

  const unit = form.watch("unit");
  const { data: holding } = useInvestmentHoldingSummary(needsHoldingSummary ? investmentAccountId : undefined);

  useEffect(() => {
    if (!isSell && !isWriteOff) return;
    if (holding == null) return;
    const amount = unit ? Number(unit) * holding.averageCostPerUnit : 0;
    form.setValue("amount", amount, { shouldValidate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSell, isWriteOff, unit, holding]);

  if (!needsInvestmentFields) return null;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      {!isSell && !isWriteOff && !isDirectBuy && (
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
      )}
      {isSell && (
        <p className="text-muted-foreground text-xs">
          Penjualan di form ini langsung dianggap selesai (dana langsung masuk ke akun kas). Untuk penjualan yang
          masih diproses (belum cair), gunakan tombol &quot;Jual Investasi&quot; di halaman detail akun investasi.
        </p>
      )}
      {isWriteOff && (
        <p className="text-muted-foreground text-xs">
          Unit yang hilang/dilepas tanpa ada kas yang berpindah (hibah, delisting, biaya admin dalam bentuk unit).
          Nominal dihitung otomatis dari cost basis unit yang dilepas.
        </p>
      )}
      {needsHoldingSummary && holding && (
        <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 text-sm">
          <p>
            Sisa unit: <span className="font-medium">{holding.remainingUnit}</span>
          </p>
          <p>
            Avg. cost/unit: <span className="font-medium">{formatCurrency(holding.averageCostPerUnit, "IDR")}</span>
          </p>
        </div>
      )}
      <UnitAmountField form={form} name="unit" optional={fieldsOptional} />
      {!isWriteOff && (
        <PricePerUnitField
          form={form}
          name="price_per_unit"
          unitFieldName="unit"
          label={isSell ? "Harga Jual per Unit" : undefined}
          optional={fieldsOptional}
        />
      )}
    </div>
  );
}
