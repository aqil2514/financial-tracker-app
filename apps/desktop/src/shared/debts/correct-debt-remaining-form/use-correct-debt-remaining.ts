"use client";

import { getDb } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import { correctDebtRemaining } from "@/shared/debts/correct-debt-remaining";
import type { DebtListRow } from "@/shared/debts/use-debts-list";
import { correctDebtRemainingSchema, type CorrectDebtRemainingFormOutput } from "./schema";

function now() {
  const date = new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function useCorrectDebtRemaining(debt: DebtListRow, onSuccess?: () => void) {
  return useEntityForm({
    schema: correctDebtRemainingSchema,
    defaultValues: () => ({
      targetRemaining: debt.remaining,
      date: now(),
      note: "",
    }),
    resetOnOpen: true,
    mutationFn: async (values: CorrectDebtRemainingFormOutput) => {
      const db = await getDb();

      const result = await correctDebtRemaining({
        db,
        debt,
        currentRemaining: debt.remaining,
        targetRemaining: values.targetRemaining,
        date: values.date,
        note: values.note,
      });

      void pushOnWrite("transactions", result.transactionId);
      void pushOnWrite("debts", debt.id);
      if (result.debtPaymentId) void pushOnWrite("debt_payments", result.debtPaymentId);

      return result.transactionId;
    },
    invalidateKey: QUERY_DEPENDENCIES.debts,
    successMessage: "Sisa berhasil dikoreksi",
    errorMessage: "Gagal mengoreksi sisa",
    onSuccess,
  });
}
