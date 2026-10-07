"use client";

import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { useEntityForm } from "@/hooks/use-entity-form";
import { dependentKeysOf } from "@/lib/query-dependencies";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import { applyInvestmentTransaction } from "@/shared/investments/apply-investment-transaction";
import { newInvestmentPurchaseSchema, type NewInvestmentPurchaseFormOutput } from "./schema";

function now() {
  const date = new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

type UseCreateInvestmentPurchaseOptions = {
  /** Kunci akun investasi tujuan — dipakai dari header
   * /investments/detail (akun tujuan sudah pasti dari konteks halaman,
   * field combobox-nya disembunyikan di form, lihat
   * new-investment-purchase-form.tsx). Undefined = field combobox tetap
   * muncul, user pilih manual (belum ada pemanggil seperti ini saat ini,
   * disiapkan untuk fleksibilitas). */
  investmentAccountId?: string;
};

/**
 * Jalan pintas "Catat Pembelian Investasi" dari header halaman
 * `/investments/detail` — pola PERSIS
 * `shared/debts/new-debt-form/use-create-debt.ts`: form bahasa
 * domain-spesifik yang DI BELAKANG LAYAR cuma insert 1 baris
 * `transactions` tipe transfer + panggil `applyInvestmentTransaction`
 * yang SAMA dengan jalur form transaksi biasa — bukan tabel/logic baru.
 * Scope CUMA beli (cash->investment), lihat
 * docs/todos/plan/account-type-investment.md.
 */
export function useCreateInvestmentPurchase(options: UseCreateInvestmentPurchaseOptions = {}) {
  const { investmentAccountId } = options;

  return useEntityForm({
    schema: newInvestmentPurchaseSchema,
    defaultValues: () => ({
      cash_account_id: "",
      investment_account_id: investmentAccountId ?? "",
      amount: 0,
      unit: null,
      price_per_unit: null,
      date: now(),
      note: "",
      status: "pending" as const,
    }),
    resetOnOpen: true,
    mutationFn: async (values: NewInvestmentPurchaseFormOutput) => {
      const db = await getDb();
      const transactionId = newId();

      await db.execute(
        `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date)
         VALUES ($1, 'transfer', $2, NULL, $3, $4, $5, NULL, $6)`,
        [
          transactionId,
          values.amount,
          values.cash_account_id,
          values.investment_account_id,
          values.note,
          values.date,
        ]
      );

      const touched = await applyInvestmentTransaction({
        db,
        transactionId,
        type: "transfer",
        accountId: values.cash_account_id,
        transferAccountId: values.investment_account_id,
        date: values.date,
        unit: values.unit,
        pricePerUnit: values.price_per_unit,
        status: values.status,
      });

      void pushOnWrite("transactions", transactionId);
      if (touched.investmentPurchaseIds[0]) {
        void pushOnWrite("investment_purchases", touched.investmentPurchaseIds[0]);
      }

      return transactionId;
    },
    // Transaksi transfer ini mempengaruhi saldo akun kas & investasi
    // (domain "transactions"), bukan cuma riwayat investment_purchases.
    invalidateKey: dependentKeysOf("transactions"),
    successMessage: "Pembelian investasi berhasil dicatat",
    errorMessage: "Gagal mencatat pembelian investasi",
  });
}
