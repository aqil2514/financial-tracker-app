"use client";

import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { dependentKeysOf } from "@/lib/query-dependencies";
import { resolveContactId } from "@/shared/contacts/resolve-contact";
import {
  applyDirectThirdPartyTransaction,
  getRemainingThirdPartyFund,
  InsufficientThirdPartyFundError,
} from "@/shared/third-party-funds";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import type { ThirdPartyFundFormOutput } from "./schemas";

type UseCreateThirdPartyFundOptions = {
  onCreated?: (transactionId: string) => void;
};

/**
 * Submit nyata untuk dialog "Catat Titip/Ambil Dana" — pola sama
 * `useCreateAccount` (dialog yang sudah punya `useForm` sendiri, hook ini
 * cuma urus mutation). `direction: 'in'` → transaksi `income`, `direction:
 * 'out'` → transaksi `expense` (lihat docs/concept/konsep-dana-pihak-ketiga.md,
 * "Titip masuk / Ambil keluar" — SATU SISI, bukan transfer). Validasi
 * oversell untuk 'out' terjadi di dalam applyDirectThirdPartyTransaction.
 *
 * Kontak WAJIB diisi (schema `third_party_funds.contact_id` NOT NULL) —
 * form sendiri sudah mewajibkan lewat ContactField, tapi `resolveContactId`
 * tetap bisa mengembalikan null kalau nama kosong (sama seperti alur
 * debt); di titik itu dianggap bug validasi form, jadi dilempar sebagai
 * error biasa alih-alih diam-diam lanjut insert NULL ke kolom NOT NULL
 * (yang akan gagal di level SQLite dengan pesan kurang jelas).
 */
export function useCreateThirdPartyFund(options: UseCreateThirdPartyFundOptions = {}) {
  const { onCreated } = options;

  const mutation = useDbMutation({
    mutationFn: async (values: ThirdPartyFundFormOutput) => {
      const contactId = await resolveContactId(values.contact_name);
      if (contactId == null) {
        throw new Error("Nama kontak wajib diisi.");
      }

      const db = await getDb();
      const type = values.direction === "in" ? "income" : "expense";

      // Validasi oversell SEBELUM insert transaksi -- @tauri-apps/plugin-sql
      // tidak mendukung ROLLBACK transaksional di sini (lihat
      // docs/rules/checking-dev-database.md soal BEGIN/COMMIT manual yang
      // bermasalah), jadi throw SETELAH insert akan meninggalkan baris
      // `transactions` "hantu" tanpa baris third_party_funds pasangannya.
      // Pola sama createDirectInvestmentWriteOff (expense/investment.ts).
      if (type === "expense") {
        const remaining = await getRemainingThirdPartyFund(db, values.account_id, contactId);
        if (values.amount > remaining) {
          throw new InsufficientThirdPartyFundError(remaining, values.amount);
        }
      }

      const transactionId = newId();
      await db.execute(
        `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date, contact_id)
         VALUES ($1, $2, $3, NULL, $4, NULL, $5, NULL, $6, $7)`,
        [transactionId, type, values.amount, values.account_id, values.note, values.date, contactId]
      );

      const touched = await applyDirectThirdPartyTransaction({
        db,
        transactionId,
        type,
        accountId: values.account_id,
        contactId,
        amount: values.amount,
        date: values.date,
        note: values.note,
      });

      // third_party_funds punya FK ke transactions(id) -- await push
      // "transactions" dulu, sama alasan dgn use-create-investment-purchase.ts
      // (race ditemukan 2026-10-21: push third_party_funds yang menang
      // duluan gagal FOREIGN KEY constraint di Worker krn baris transactions
      // belum ter-INSERT di D1).
      await pushOnWrite("transactions", transactionId);
      for (const id of touched.thirdPartyFundIds) {
        void pushOnWrite("third_party_funds", id);
      }

      return transactionId;
    },
    invalidateKey: dependentKeysOf("transactions", "accounts"),
    successMessage: "Dana pihak ketiga berhasil dicatat",
    errorMessage: "Gagal mencatat dana pihak ketiga",
    onSuccess: (transactionId) => {
      onCreated?.(transactionId);
    },
  });

  return {
    onSubmit: mutation.mutate,
    isPending: mutation.isPending,
  };
}
