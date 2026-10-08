"use client";

import { getDb } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { dependentKeysOf } from "@/lib/query-dependencies";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import { applyWriteOffInvestmentTransaction } from "@/shared/investments/apply-write-off-investment-transaction";
import { writeOffInvestmentSchema, type WriteOffInvestmentFormOutput } from "./schema";

function now() {
  const date = new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

type UseWriteOffInvestmentOptions = {
  /** Kunci akun investasi — pola PERSIS `useCreateInvestmentSale`
   * (investmentAccountId), dipakai dari header /investments/detail. */
  investmentAccountId?: string;
};

/**
 * Form "Write-off Unit" — catat unit yang hilang/dilepas TANPA kas yang
 * berpindah (hibah ke orang lain, delisting/perusahaan bangkrut, biaya
 * admin dipotong dalam bentuk unit). Pola PERSIS `useCreateInvestmentSale`,
 * jauh lebih sederhana — TIDAK ada status pending/settled, TIDAK ada akun
 * kas tujuan. Lihat apply-write-off-investment-transaction.ts +
 * docs/concept/konsep-investasi.md bagian "Unit yang berubah TANPA
 * transfer kas" (arah berkurang).
 */
export function useWriteOffInvestment(options: UseWriteOffInvestmentOptions = {}) {
  const { investmentAccountId } = options;

  return useEntityForm({
    schema: writeOffInvestmentSchema,
    defaultValues: () => ({
      investment_account_id: investmentAccountId ?? "",
      unit: 0,
      date: now(),
      note: "",
    }),
    resetOnOpen: true,
    mutationFn: async (values: WriteOffInvestmentFormOutput) => {
      const db = await getDb();

      const result = await applyWriteOffInvestmentTransaction({
        db,
        accountId: values.investment_account_id,
        date: values.date,
        note: values.note,
        unit: values.unit,
      });

      await pushOnWrite("transactions", result.transactionId);
      void pushOnWrite("investment_sales", result.investmentSaleId);

      return result.investmentSaleId;
    },
    invalidateKey: dependentKeysOf("transactions"),
    successMessage: "Write-off unit berhasil dicatat",
    errorMessage: "Gagal mencatat write-off unit",
  });
}
