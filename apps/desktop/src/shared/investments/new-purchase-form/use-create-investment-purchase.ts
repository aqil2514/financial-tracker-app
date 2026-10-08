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
 * domain-spesifik yang DI BELAKANG LAYAR cuma insert baris
 * `transactions` + `investment_purchases` — bukan tabel/logic baru. Dua
 * mode (field `record_mode`, lihat schema.ts):
 *
 * - `'transfer'` (jalur lama): insert 1 transaksi transfer kas->investment
 *   + panggil `applyInvestmentTransaction` (sama dengan jalur form
 *   transaksi biasa).
 * - `'direct'`: unit bertambah TANPA transfer kas (hibah, bonus saham,
 *   right issue/warrant, atau saldo & unit awal sebelum pakai app) --
 *   TIDAK menyentuh saldo akun kas manapun, TAPI tetap WAJIB transaksi
 *   `income` langsung pada akun investment itu sendiri (pola identik
 *   `record_mode: 'direct'` di use-create-debt.ts, arah create bukan
 *   write-off) supaya saldo akun investment ikut berubah sesuai prinsip
 *   "accounts.balance hanya berubah lewat transactions". Baris
 *   `investment_purchases` di-insert LANGSUNG (BUKAN lewat
 *   `applyInvestmentTransaction`, yang exclusive utk type='transfer' --
 *   lihat guard di apply-investment-transaction.ts), status selalu
 *   'settled' (nilainya sudah pasti saat diterima). Lihat
 *   docs/concept/konsep-investasi.md bagian "Unit yang berubah TANPA
 *   transfer kas" dan docs/todos/plan/account-type-investment.md.
 */
export function useCreateInvestmentPurchase(options: UseCreateInvestmentPurchaseOptions = {}) {
  const { investmentAccountId } = options;

  return useEntityForm({
    schema: newInvestmentPurchaseSchema,
    defaultValues: () => ({
      record_mode: "transfer" as const,
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

      if (values.record_mode === "direct") {
        const transactionId = newId();
        await db.execute(
          `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date)
           VALUES ($1, 'income', $2, NULL, $3, NULL, $4, NULL, $5)`,
          [transactionId, values.amount, values.investment_account_id, values.note, values.date]
        );

        const investmentPurchaseId = newId();
        await db.execute(
          `INSERT INTO investment_purchases (id, account_id, transaction_id, unit, price_per_unit, date, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'settled')`,
          [
            investmentPurchaseId,
            values.investment_account_id,
            transactionId,
            values.unit,
            values.price_per_unit,
            values.date,
          ]
        );

        await pushOnWrite("transactions", transactionId);
        void pushOnWrite("investment_purchases", investmentPurchaseId);

        return transactionId;
      }

      // record_mode === 'transfer' -- jalur lama.
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
    // Transaksi transfer/income ini mempengaruhi saldo akun kas (transfer)
    // dan/atau investasi (domain "transactions"), bukan cuma riwayat
    // investment_purchases.
    invalidateKey: dependentKeysOf("transactions"),
    successMessage: "Pembelian investasi berhasil dicatat",
    errorMessage: "Gagal mencatat pembelian investasi",
  });
}
