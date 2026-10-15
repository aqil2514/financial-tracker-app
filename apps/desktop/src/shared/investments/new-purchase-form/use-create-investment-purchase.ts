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
 * `/investments/detail` — insert 1 transaksi transfer kas->investment +
 * panggil `applyInvestmentTransaction` (sama dengan jalur form transaksi
 * biasa).
 *
 * Pembelian direct (tanpa transfer kas — hibah, bonus saham, right
 * issue/warrant, saldo & unit awal) sekarang dicatat lewat form
 * transaksi utama (income langsung ke akun investment) — lihat
 * docs/todos/plan/unify-direct-writeoff-into-main-transaction-form.md.
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

      const cashAccountId = values.cash_account_id as string;
      const transactionId = newId();

      await db.execute(
        `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date)
         VALUES ($1, 'transfer', $2, NULL, $3, $4, $5, NULL, $6)`,
        [
          transactionId,
          values.amount,
          cashAccountId,
          values.investment_account_id,
          values.note,
          values.date,
        ]
      );

      const touched = await applyInvestmentTransaction({
        db,
        transactionId,
        type: "transfer",
        accountId: cashAccountId,
        transferAccountId: values.investment_account_id,
        date: values.date,
        unit: values.unit,
        pricePerUnit: values.price_per_unit,
        status: values.status,
      });

      // investment_purchases punya FK ke transactions(id) -- await push
      // "transactions" dulu, sama alasan dgn use-create-transaction.ts.
      await pushOnWrite("transactions", transactionId);
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
