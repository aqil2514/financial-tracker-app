"use client";

import { getDb } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { resolveContactId } from "@/shared/contacts/resolve-contact";
import { applyDebtTransaction } from "@/shared/debts/apply-debt-transaction";
import { newDebtSchema, type NewDebtFormOutput } from "./schema";

function now() {
  const date = new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

/**
 * Jalan pintas untuk mencatat piutang/utang baru langsung dari halaman
 * `/debts`, tanpa lewat form transaksi lengkap — di baliknya tetap
 * membuat 1 transaksi transfer biasa (kas<->debt) lalu memicu
 * `applyDebtTransaction` yang sama persis dengan jalur form transaksi
 * (lihat "Tambah Utang/Piutang Baru dari halaman /debts" di
 * debt-receivable-tracking.md). Arah transfer ditentukan dari
 * `debt_type`, jadi TIDAK ambigu — tidak butuh `DebtActionField`.
 */
export function useCreateDebt() {
  return useEntityForm({
    schema: newDebtSchema,
    defaultValues: () => ({
      debt_type: "receivable" as const,
      contact_name: null,
      amount: 0,
      cash_account_id: "",
      debt_account_id: "",
      date: now(),
      note: "",
    }),
    resetOnOpen: true,
    mutationFn: async (values: NewDebtFormOutput) => {
      const contactId = await resolveContactId(values.contact_name);

      const db = await getDb();
      const cashAccountId = Number(values.cash_account_id);
      const debtAccountId = Number(values.debt_account_id);

      // receivable: kas -> debt. payable: debt -> kas.
      const accountId = values.debt_type === "receivable" ? cashAccountId : debtAccountId;
      const transferAccountId =
        values.debt_type === "receivable" ? debtAccountId : cashAccountId;

      const result = await db.execute(
        `INSERT INTO transactions (type, amount, category_id, account_id, transfer_account_id, note, description, date, contact_id)
         VALUES ('transfer', $1, NULL, $2, $3, $4, NULL, $5, $6)`,
        [values.amount, accountId, transferAccountId, values.note, values.date, contactId]
      );
      const transactionId = result.lastInsertId ?? null;

      if (transactionId != null) {
        await applyDebtTransaction({
          db,
          transactionId,
          type: "transfer",
          accountId,
          transferAccountId,
          contactId,
          amount: values.amount,
          date: values.date,
          // debt_type === 'payable' berarti arah transfer adalah
          // debt->kas, yang ambigu di applyDebtTransaction tanpa
          // debtAction eksplisit — form ini SELALU berarti "utang baru",
          // tidak pernah pelunasan (itu tugas form "Catat Pembayaran"
          // yang terpisah), jadi dipaksa 'payable' di sini.
          debtAction: values.debt_type === "payable" ? "payable" : null,
          settleDebtIds: [],
        });
      }

      return transactionId;
    },
    invalidateKey: QUERY_DEPENDENCIES.debts,
    successMessage: "Utang/piutang baru berhasil dicatat",
    errorMessage: "Gagal mencatat utang/piutang baru",
  });
}
