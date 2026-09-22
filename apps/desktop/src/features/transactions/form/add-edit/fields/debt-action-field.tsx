"use client";

import { Controller, useWatch, type Control } from "react-hook-form";

import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { useContacts } from "@/shared/contacts/use-contacts";
import { useOngoingDebts } from "@/shared/debts/use-ongoing-debts";
import type { TransactionDebtStatus } from "@/shared/debts/use-transaction-debt-status";
import { TransactionFormValues } from "../schema";

type DebtActionFieldProps = {
  control: Control<TransactionFormValues>;
  /** ID transaksi yang sedang diedit + status debt-nya — dipakai supaya
   * kalau transaksi ini SENDIRI adalah pembayaran (`role: 'payment'`)
   * untuk sebuah piutang yang sudah `status='paid'`, piutang itu TETAP
   * muncul di checklist (lihat use-ongoing-debts.ts). Undefined saat
   * form create (transaksi belum ada, tidak mungkin py peran apa pun). */
  transactionId?: number;
  debtStatus?: TransactionDebtStatus;
};

/**
 * Muncul kalau transfer terdeteksi arah debt->cash (lihat
 * involvesDebtCashInflow di transaction-form.tsx) — arah transfer semata
 * tidak cukup untuk tahu apakah ini pelunasan piutang existing atau
 * utang baru (lihat "Deteksi otomatis debts dari transfer" di
 * debt-receivable-tracking.md), jadi user memilih eksplisit di sini.
 */
export function DebtActionField({ control, transactionId, debtStatus }: DebtActionFieldProps) {
  const contactName = useWatch({ control, name: "contact_name" });
  const { data: contacts } = useContacts();
  const contactId =
    contacts?.find((contact) => contact.name.toLowerCase() === contactName?.trim().toLowerCase())
      ?.id ?? null;

  const { data: ongoingDebts } = useOngoingDebts(contactId, {
    excludeDebtId: debtStatus?.role === "payment" ? debtStatus.debtId : undefined,
    excludeTransactionId: debtStatus?.role === "payment" ? transactionId : undefined,
  });

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <Controller
        control={control}
        name="debt_action"
        render={({ field, fieldState }) => (
          <div className="space-y-2">
            <Label>Uang ini untuk apa?</Label>
            <ToggleGroup
              value={field.value ? [field.value] : []}
              onValueChange={(values: string[]) => {
                if (values.length > 0) {
                  field.onChange(values[values.length - 1]);
                }
              }}
              className="w-full"
            >
              <ToggleGroupItem value="settlement" className="flex-1">
                Pelunasan piutang yang sudah ada
              </ToggleGroupItem>
              <ToggleGroupItem value="payable" className="flex-1">
                Utang baru dari kontak ini
              </ToggleGroupItem>
            </ToggleGroup>
            {fieldState.error && (
              <p className="text-destructive text-sm">{fieldState.error.message}</p>
            )}
          </div>
        )}
      />

      <Controller
        control={control}
        name="debt_action"
        render={({ field: debtActionField }) =>
          debtActionField.value === "settlement" ? (
            <Controller
              control={control}
              name="settle_debt_ids"
              render={({ field, fieldState }) => (
                <div className="space-y-2">
                  <Label>Pilih piutang yang dilunasi</Label>
                  {!contactId ? (
                    <p className="text-muted-foreground text-sm">
                      Pilih kontak dulu untuk melihat daftar piutangnya.
                    </p>
                  ) : ongoingDebts && ongoingDebts.length > 0 ? (
                    <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
                      {ongoingDebts.map((debt) => {
                        const idStr = String(debt.id);
                        const checked = field.value.includes(idStr);
                        return (
                          <label
                            key={debt.id}
                            className="flex cursor-pointer items-center gap-2 text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(next) => {
                                field.onChange(
                                  next
                                    ? [...field.value, idStr]
                                    : field.value.filter((id) => id !== idStr)
                                );
                              }}
                            />
                            <span className="flex-1">
                              {formatDate(debt.date, "date-time")}
                            </span>
                            <span className="text-muted-foreground">
                              Sisa {formatCurrency(debt.remaining, "IDR")}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Kontak ini tidak punya piutang yang masih berjalan.
                    </p>
                  )}
                  {fieldState.error && (
                    <p className="text-destructive text-sm">{fieldState.error.message}</p>
                  )}
                </div>
              )}
            />
          ) : (
            <></>
          )
        }
      />
    </div>
  );
}
