"use client";

import { Controller } from "react-hook-form";

import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { useTransactionFormFields } from "../../context/transaction-form-fields-context";

const SETTLEMENT_LABEL: Record<"receivable" | "payable", string> = {
  receivable: "Pilih piutang yang dilunasi",
  payable: "Pilih utang yang dilunasi",
};

export function FieldDebtAction() {
  const { form, needsDebtAction, settlementDirection, ongoingDebts } = useTransactionFormFields();
  const control = form.control;

  if (!needsDebtAction || settlementDirection == null) return null;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <Controller
        control={control}
        name="settle_debt_ids"
        render={({ field, fieldState }) => (
          <div className="space-y-2">
            <Label>{SETTLEMENT_LABEL[settlementDirection]}</Label>
            {ongoingDebts && ongoingDebts.length > 0 ? (
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
                {ongoingDebts.map((debt) => {
                  const idStr = String(debt.id);
                  const checked = field.value.includes(idStr);
                  return (
                    <label key={debt.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(next) => {
                          field.onChange(
                            next ? [...field.value, idStr] : field.value.filter((id) => id !== idStr)
                          );
                        }}
                      />
                      <span className="flex-1">{formatDate(debt.date, "date-time")}</span>
                      <span className="text-muted-foreground">
                        Sisa {formatCurrency(debt.remaining, "IDR")}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Kontak ini tidak punya {settlementDirection === "receivable" ? "piutang" : "utang"} yang
                masih berjalan.
              </p>
            )}
            {fieldState.error && <p className="text-destructive text-sm">{fieldState.error.message}</p>}
          </div>
        )}
      />
    </div>
  );
}
