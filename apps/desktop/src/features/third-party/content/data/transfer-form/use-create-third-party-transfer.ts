"use client";

import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { dependentKeysOf } from "@/lib/query-dependencies";
import { resolveContactId } from "@/shared/contacts/resolve-contact";
import {
  applyThirdPartyTransfer,
  getRemainingThirdPartyFund,
  InsufficientThirdPartyFundError,
} from "@/shared/third-party-funds";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import type { ThirdPartyTransferFormOutput } from "./schemas";

type UseCreateThirdPartyTransferOptions = {
  onCreated?: (transactionId: string) => void;
};

/**
 * Submit "Pindah Tempat/Kepemilikan" — transfer `third_party→third_party`
 * (lihat docs/concept/konsep-dana-pihak-ketiga.md, "Pindah tempat dan/atau
 * pindah kepemilikan"). Pola sama `useCreateThirdPartyFund`: validasi
 * oversell SEBELUM insert transaksi (lihat komentar panjang di sana soal
 * kenapa — @tauri-apps/plugin-sql tidak rollback otomatis).
 *
 * `values.kind` ("move_location"/"move_ownership"/"both") HANYA dipakai
 * ThirdPartyTransferForm untuk presentasi — di titik ini semua kasus
 * sama-sama satu `applyThirdPartyTransfer` dengan 4 pasangan akun+kontak
 * yang sudah di-resolve form (termasuk field yang disembunyikan, sudah
 * di-sync otomatis ke field yang terlihat, lihat useFieldSync).
 */
export function useCreateThirdPartyTransfer(options: UseCreateThirdPartyTransferOptions = {}) {
  const { onCreated } = options;

  const mutation = useDbMutation({
    mutationFn: async (values: ThirdPartyTransferFormOutput) => {
      const [sourceContactId, destinationContactId] = await Promise.all([
        resolveContactId(values.source_contact_name),
        resolveContactId(values.destination_contact_name),
      ]);
      if (sourceContactId == null || destinationContactId == null) {
        throw new Error("Nama kontak asal dan tujuan wajib diisi.");
      }

      const db = await getDb();

      // Validasi oversell SEBELUM insert transaksi -- lihat komentar
      // panjang di use-create-third-party-fund.ts soal kenapa urutan ini
      // wajib (transaksi "hantu" kalau terbalik).
      const remaining = await getRemainingThirdPartyFund(db, values.source_account_id, sourceContactId);
      if (values.amount > remaining) {
        throw new InsufficientThirdPartyFundError(remaining, values.amount);
      }

      const transactionId = newId();
      await db.execute(
        `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date, contact_id)
         VALUES ($1, 'transfer', $2, NULL, $3, $4, $5, NULL, $6, $7)`,
        [
          transactionId,
          values.amount,
          values.source_account_id,
          values.destination_account_id,
          values.note,
          values.date,
          sourceContactId,
        ]
      );

      const touched = await applyThirdPartyTransfer({
        db,
        transactionId,
        sourceAccountId: values.source_account_id,
        sourceContactId,
        destinationAccountId: values.destination_account_id,
        destinationContactId,
        amount: values.amount,
        date: values.date,
        note: values.note,
      });

      // third_party_funds punya FK ke transactions(id) -- await push
      // "transactions" dulu, sama alasan dgn use-create-investment-purchase.ts
      // (race ditemukan 2026-10-21, lihat use-create-third-party-fund.ts).
      await pushOnWrite("transactions", transactionId);
      for (const id of touched.thirdPartyFundIds) {
        void pushOnWrite("third_party_funds", id);
      }

      return transactionId;
    },
    invalidateKey: dependentKeysOf("transactions", "accounts"),
    successMessage: "Perpindahan dana pihak ketiga berhasil dicatat",
    errorMessage: "Gagal mencatat perpindahan dana pihak ketiga",
    onSuccess: (transactionId) => {
      onCreated?.(transactionId);
    },
  });

  return {
    onSubmit: mutation.mutate,
    isPending: mutation.isPending,
  };
}
