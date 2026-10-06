"use client";

import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";

import { FormFieldToggleGroup } from "@/components/forms/form-fields";
import { formatCurrency } from "@/lib/format-currency";
import { PricePerUnitField } from "@/shared/investments/price-per-unit-field";
import { UnitAmountField } from "@/shared/investments/unit-amount-field";
import { useInvestmentHoldingSummary } from "@/shared/investments/use-investment-holding-summary";
import type { TransactionFormOutput, TransactionFormValues } from "../schema";

type InvestmentFieldsProps = {
  form: UseFormReturn<TransactionFormValues, unknown, TransactionFormOutput>;
  /** true untuk arah jual (investment->cash) — beda dari beli (default
   * false): unit/harga SELALU wajib (tidak ada opsi "isi belakangan"),
   * dan label/placeholder disesuaikan ke bahasa jual. Lihat
   * useTransactionInvestmentFields untuk deteksi arahnya. */
  isSell?: boolean;
  /** Akun investasi SUMBER transfer — cuma dipakai saat `isSell` untuk
   * query sisa unit + average cost (useInvestmentHoldingSummary) dan
   * auto-sync field `amount`. Untuk arah beli, akun investment adalah
   * TUJUAN (bukan sumber), jadi prop ini diabaikan di mode itu. */
  investmentAccountId?: string;
};

/**
 * Muncul begitu transfer melibatkan akun `account_type='investment'`
 * (lihat useTransactionInvestmentFields) — unit & harga per unit MANUAL,
 * independen satu sama lain dan dari nominal transfer (TIDAK divalidasi
 * harus sama), lihat docs/concept/konsep-investasi.md bagian "Unit dan
 * harga per unit".
 *
 * Switch status Pending/Settled (pola sama
 * `shared/investments/new-purchase-form/`) — untuk BELI: Pending
 * (default) unit & harga OPSIONAL, boleh dikosongkan kalau order masih
 * diproses dan nilainya belum diketahui pasti, diisi belakangan lewat
 * edit baris di halaman detail investasi; Settled unit & harga WAJIB.
 *
 * Untuk JUAL (`isSell`): TIDAK ADA toggle status sama sekali — form
 * transaksi utama ini SELALU insert satu baris `transactions` begitu
 * disubmit (arsitektur dipakai bersama semua tipe transaksi, lihat
 * use-create-transaction.ts), tapi penjualan investasi `pending` justru
 * TIDAK BOLEH membuat transaksi apa pun (dana belum cair ke kas sampai
 * settled, lihat apply-sell-investment-transaction.ts) — dua hal ini
 * kontradiktif. Keputusan 2026-10-07: form utama HANYA mendukung jual
 * `settled` langsung; status `pending` cuma lewat dialog "Jual Investasi"
 * khusus (shared/investments/sell-investment-form/), yang TIDAK selalu
 * insert transaksi. (Aksi "Settle" belakangan untuk baris pending yang
 * sudah ada — lewat menu per-baris di riwayat — didiskusikan terpisah,
 * belum dikerjakan di sini.)
 */
export function InvestmentFields({ form, isSell = false, investmentAccountId }: InvestmentFieldsProps) {
  const status = form.watch("investment_status");
  const isSettled = isSell ? true : status === "settled";
  const fieldsOptional = !isSell && !isSettled;

  useEffect(() => {
    if (isSell) form.setValue("investment_status", "settled", { shouldValidate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sekali per toggle isSell, form stabil dari closure
  }, [isSell]);

  const unit = form.watch("unit");
  const { data: holding } = useInvestmentHoldingSummary(isSell ? investmentAccountId : undefined);

  // Mode jual: `amount` (nominal transfer yang BENAR-benar tersimpan ke
  // transactions.amount) BUKAN diketik manual -- dikunci read-only di
  // form.tsx (lihat needsInvestmentSellFields) dan disinkronkan otomatis
  // ke average_cost * unit di sini, supaya user melihat preview nominal
  // yang akan tersimpan SEBELUM submit. use-create-transaction.ts/
  // use-update-transaction.ts menghitung ulang sendiri nilai yang SAMA
  // saat submit (sumber kebenaran, bukan nilai form ini) -- lihat
  // komentar di sana.
  useEffect(() => {
    if (!isSell || holding == null) return;
    const amount = unit ? Number(unit) * holding.averageCostPerUnit : 0;
    form.setValue("amount", amount, { shouldValidate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reaksi ke unit/holding saja, form stabil dari closure
  }, [isSell, unit, holding]);

  return (
    <div className="space-y-4 rounded-lg border p-4">
      {!isSell && (
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
      {isSell && holding && (
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
      <PricePerUnitField
        form={form}
        name="price_per_unit"
        unitFieldName="unit"
        label={isSell ? "Harga Jual per Unit" : undefined}
        optional={fieldsOptional}
      />
    </div>
  );
}
