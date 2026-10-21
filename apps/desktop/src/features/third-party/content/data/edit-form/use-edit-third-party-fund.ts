"use client";

import { getDb } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { dependentKeysOf } from "@/lib/query-dependencies";
import {
  getRemainingThirdPartyFundExcluding,
  InsufficientThirdPartyFundError,
} from "@/shared/third-party-funds";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import type { ThirdPartyFundRow } from "../use-third-party-funds";
import { editThirdPartyFundSchema, type EditThirdPartyFundFormOutput } from "./schema";

/**
 * Edit ringkas baris Titip/Ambil (direct, 1 baris) — pola sama
 * `useEditPayment` (shared/debts/edit-payment-form/): field "berbahaya"
 * (akun, kontak, arah) TETAP terkunci ke nilai asli, cuma
 * Nominal/Tanggal/Catatan yang diizinkan. HANYA berlaku untuk baris yang
 * `transaction_id != null` DAN bukan bagian dari transfer (caller/UI yang
 * menjamin ini — lihat guard tombol Edit di `list.tsx`).
 *
 * BEDA dari `useEditPayment` (tidak ada status 'paid'/'ongoing' yang
 * perlu disesuaikan ulang) — `third_party_funds` tidak punya kolom status
 * sama sekali, sisa titipan selalu dihitung ulang dari SUM (lihat
 * docs/concept/konsep-dana-pihak-ketiga.md "Keputusan final"). Jadi edit
 * di sini CUKUP: validasi sisa SETELAH perubahan (baris lama ini sendiri
 * DIKECUALIKAN dari perhitungan dulu lewat getRemainingThirdPartyFundExcluding,
 * baru nominal BARU diterapkan ulang sesuai arahnya) tetap >= 0, lalu
 * UPDATE langsung transactions + third_party_funds (keduanya sekarang
 * ikut di-push ke Worker, lihat docs/todos/plan/third-party-sync.md
 * Tahap 3).
 *
 * **Bug ditemukan 2026-10-21 (dogfooding)**: validasi SEBELUMNYA cuma
 * dicek kalau `fund.direction === "out"` (menurunkan sisa) -- padahal
 * MENGECILKAN nominal baris 'in' (titip) sama bahayanya kalau sudah ada
 * 'out' (ambil) yang bergantung padanya (sisa bisa jadi NEGATIF, lolos
 * tanpa ditolak). Diperbaiki jadi berlaku utk KEDUA arah: sisa SETELAH
 * edit = remainingExcluding + newAmount (utk 'in') atau
 * remainingExcluding - newAmount (utk 'out'), keduanya WAJIB >= 0.
 */
export function useEditThirdPartyFund(fund: ThirdPartyFundRow, onSuccess?: () => void) {
  return useEntityForm({
    schema: editThirdPartyFundSchema,
    defaultValues: () => ({
      amount: fund.amount,
      date: fund.date,
      note: fund.note ?? "",
    }),
    resetOnOpen: true,
    mutationFn: async (values: EditThirdPartyFundFormOutput) => {
      const db = await getDb();

      const remainingExcluding = await getRemainingThirdPartyFundExcluding(
        db,
        fund.account_id,
        fund.contact_id,
        fund.id
      );

      if (fund.direction === "out") {
        if (values.amount > remainingExcluding) {
          throw new InsufficientThirdPartyFundError(remainingExcluding, values.amount);
        }
      } else {
        // direction 'in' (titip) dikecilkan -- bahaya yang SIMETRIS dgn
        // 'out' di atas: kalau sudah ada 'out' yang bergantung pada
        // nominal titip lama, menurunkannya bisa membuat sisa jadi
        // negatif. remainingExcluding di sini SELALU <= 0 kalau ada 'out'
        // yg lebih besar dari 'in' lain (baris ini sendiri sudah
        // dikecualikan) -- minimum nominal baru yang masih aman adalah
        // -remainingExcluding.
        const remainingAfterEdit = remainingExcluding + values.amount;
        if (remainingAfterEdit < 0) {
          const minimumAmount = -remainingExcluding;
          throw new Error(
            `Nominal titip tidak bisa diturunkan sampai ${values.amount} -- sudah ada riwayat ambil yang bergantung pada titipan ini, minimal ${minimumAmount} supaya sisa titipan tidak negatif.`
          );
        }
      }

      if (fund.transaction_id != null) {
        await db.execute(
          "UPDATE transactions SET amount = $1, date = $2, note = $3 WHERE id = $4",
          [values.amount, values.date, values.note, fund.transaction_id]
        );
        void pushOnWrite("transactions", fund.transaction_id);
      }

      await db.execute(
        "UPDATE third_party_funds SET amount = $1, date = $2, note = $3 WHERE id = $4",
        [values.amount, values.date, values.note, fund.id]
      );
      void pushOnWrite("third_party_funds", fund.id);
    },
    invalidateKey: dependentKeysOf("transactions", "accounts"),
    successMessage: "Riwayat berhasil diperbarui",
    errorMessage: "Gagal memperbarui riwayat",
    onSuccess,
  });
}
