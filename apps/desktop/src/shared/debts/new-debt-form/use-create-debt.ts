"use client";

import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
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
 * `/debts`, tanpa lewat form transaksi lengkap. Dua mode (field
 * `record_mode`, lihat schema.ts):
 *
 * - `'transfer'` (jalur lama): membuat 1 transaksi transfer biasa
 *   (kas<->debt) lalu memicu `applyDebtTransaction` yang sama persis
 *   dengan jalur form transaksi (lihat "Tambah Utang/Piutang Baru dari
 *   halaman /debts" di debt-receivable-tracking.md). Arah transfer
 *   ditentukan dari `debt_type`, jadi TIDAK ambigu — tidak butuh
 *   `DebtActionField`.
 * - `'direct'` (baru): insert langsung ke `debts` TANPA transaksi apa
 *   pun — `transaction_id`/`account_id` NULL sejak lahir, tidak
 *   menyentuh saldo akun manapun. Untuk kasus uang yang sudah
 *   berpindah DI LUAR app (pinjam tunai, barter, piutang lama). Lihat
 *   docs/todos/plan/debts-sync-and-non-transfer-debts.md.
 */
export function useCreateDebt() {
  return useEntityForm({
    schema: newDebtSchema,
    defaultValues: () => ({
      debt_type: "receivable" as const,
      record_mode: "transfer" as const,
      contact_name: null,
      amount: 0,
      cash_account_id: null,
      debt_account_id: null,
      date: now(),
      note: "",
    }),
    resetOnOpen: true,
    mutationFn: async (values: NewDebtFormOutput) => {
      const contactId = await resolveContactId(values.contact_name);
      const db = await getDb();

      if (values.record_mode === "direct") {
        const debtId = newId();
        await db.execute(
          `INSERT INTO debts (id, type, contact_id, amount, account_id, transaction_id, date, note)
           VALUES ($1, $2, $3, $4, NULL, NULL, $5, $6)`,
          [debtId, values.debt_type, contactId, values.amount, values.date, values.note]
        );
        return debtId;
      }

      // Sudah divalidasi wajib terisi oleh schema.ts untuk record_mode === 'transfer'.
      const cashAccountId = values.cash_account_id as string;
      const debtAccountId = values.debt_account_id as string;

      // receivable: kas -> debt. payable: debt -> kas.
      const accountId = values.debt_type === "receivable" ? cashAccountId : debtAccountId;
      const transferAccountId =
        values.debt_type === "receivable" ? debtAccountId : cashAccountId;
      const transactionId = newId();

      await db.execute(
        `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date, contact_id)
         VALUES ($1, 'transfer', $2, NULL, $3, $4, $5, NULL, $6, $7)`,
        [transactionId, values.amount, accountId, transferAccountId, values.note, values.date, contactId]
      );

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

      return transactionId;
    },
    invalidateKey: QUERY_DEPENDENCIES.debts,
    successMessage: "Utang/piutang baru berhasil dicatat",
    errorMessage: "Gagal mencatat utang/piutang baru",
  });
}
