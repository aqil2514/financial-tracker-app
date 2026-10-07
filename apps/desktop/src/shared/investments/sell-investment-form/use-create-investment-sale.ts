"use client";

import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { useEntityForm } from "@/hooks/use-entity-form";
import { dependentKeysOf } from "@/lib/query-dependencies";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import { applySellInvestmentTransaction } from "@/shared/investments/apply-sell-investment-transaction";
import { getAverageCostPerUnit } from "@/shared/investments/investment-holding-math";
import { sellInvestmentSchema, type SellInvestmentFormOutput } from "./schema";

function now() {
  const date = new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

type UseCreateInvestmentSaleOptions = {
  /** Kunci akun investasi sumber — pola PERSIS `useCreateInvestmentPurchase`
   * (investmentAccountId), dipakai dari header /investments/detail. */
  investmentAccountId?: string;
};

/**
 * Form "Jual Investasi" — pola PERSIS `useCreateInvestmentPurchase`
 * (new-purchase-form/use-create-investment-purchase.ts), arah sebaliknya.
 * SATU-SATUNYA jalur yang mendukung status `pending` untuk jual (lihat
 * InvestmentFields di form transaksi utama — arah jual di situ dipaksa
 * `settled`, keputusan 2026-10-07).
 *
 * **Status `pending`**: TIDAK insert baris `transactions` apa pun — dana
 * belum cair ke kas sampai settlement dikonfirmasi (lihat komentar
 * panjang di apply-sell-investment-transaction.ts,
 * applySellInvestmentTransaction). Nominal "Nominal yang masuk ke akun
 * kas" yang ditampilkan di form (`unit × harga jual`) murni PROYEKSI,
 * bukan nominal yang benar-benar tersimpan di titik ini.
 *
 * **Status `settled`**: insert leg transfer (`average_cost × unit`) DI
 * SINI (pola PERSIS form beli/debt — caller yang insert transaksi,
 * `applySellInvestmentTransaction` cuma urus leg penyesuaian P/L + baris
 * `investment_sales`, lihat komentar di fungsi itu).
 */
export function useCreateInvestmentSale(options: UseCreateInvestmentSaleOptions = {}) {
  const { investmentAccountId } = options;

  return useEntityForm({
    schema: sellInvestmentSchema,
    defaultValues: () => ({
      cash_account_id: null,
      investment_account_id: investmentAccountId ?? "",
      unit: 0,
      price_per_unit: 0,
      date: now(),
      note: "",
      status: "pending" as const,
    }),
    resetOnOpen: true,
    mutationFn: async (values: SellInvestmentFormOutput) => {
      const db = await getDb();

      let transactionId: string | null = null;
      // Schema (superRefine) menjamin cash_account_id terisi kalau status
      // settled -- narrow eksplisit di sini supaya tidak perlu non-null
      // assertion di pemanggilan db.execute/applySellInvestmentTransaction.
      if (values.status === "settled" && values.cash_account_id != null) {
        const cashAccountId = values.cash_account_id;
        // Nominal leg transfer utama HARUS average cost * unit (bukan
        // pricePerUnit * unit) -- lihat docs/concept/konsep-investasi.md
        // "Efek ke accounts.balance". Dihitung lewat getAverageCostPerUnit
        // yang SAMA dipakai applySellInvestmentTransaction (satu-satunya
        // sumber rumus, lihat investment-holding-math.ts).
        const averageCost = await getAverageCostPerUnit(db, values.investment_account_id);
        transactionId = newId();
        await db.execute(
          `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date)
           VALUES ($1, 'transfer', $2, NULL, $3, $4, $5, NULL, $6)`,
          [transactionId, averageCost * values.unit, values.investment_account_id, cashAccountId, values.note, values.date]
        );
      }

      const touched = await applySellInvestmentTransaction({
        db,
        transactionId,
        accountId: values.investment_account_id,
        transferAccountId: values.cash_account_id,
        date: values.date,
        unit: values.unit,
        pricePerUnit: values.price_per_unit,
        status: values.status,
      });

      // investment_sales punya FK ke transactions(id) (transaction_id,
      // terisi hanya kalau status settled) -- await push "transactions"
      // dulu sebelum push "investment_sales", sama alasan dgn
      // use-create-transaction.ts. Status pending: transactionId null,
      // tidak ada apa pun utk di-await di sini.
      if (transactionId != null) await pushOnWrite("transactions", transactionId);
      if (touched.adjustmentTransactionId != null) {
        void pushOnWrite("transactions", touched.adjustmentTransactionId);
      }
      if (touched.investmentSaleIds[0]) {
        void pushOnWrite("investment_sales", touched.investmentSaleIds[0]);
      }

      return touched.investmentSaleIds[0];
    },
    // Baris pending TIDAK mempengaruhi transactions sama sekali -- tapi
    // domain "transactions" tetap diinvalidate di sini (bukan dibuat
    // bersyarat per status) supaya satu invalidateKey yang konsisten
    // dipakai utk kedua kasus, dan jalur settled (yang memang menyentuh
    // transactions) tetap benar tanpa cabang kode tambahan.
    invalidateKey: dependentKeysOf("transactions"),
    successMessage: "Penjualan investasi berhasil dicatat",
    errorMessage: "Gagal mencatat penjualan investasi",
  });
}
