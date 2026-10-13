"use client";

/**
 * PATOKAN/REFERENSI — BELUM di-wire ke mana pun, JANGAN diimpor dari
 * tempat lain. Versi `useCreateTransaction` yang kompatibel dengan pola
 * `BaseForm` (lihat ../../components/transaction-form-with-base-form.tsx)
 * — `useDbMutation` langsung, bukan `useEntityForm`, pola PERSIS
 * `useCreateAccount` (features/accounts).
 *
 * `createTransaction` (mutationFn) di-reuse LANGSUNG dari lokasi lama
 * (`../../../hooks/use-create-transaction/create-transaction`) — logic
 * mutation murni itu sudah lepas dari `useEntityForm` sejak refactor
 * sebelumnya dan dipakai BERSAMA oleh versi lama & patokan ini, jadi
 * TIDAK ikut dipindah ke folder `base-form-migration/` ini.
 *
 * Beda kunci dari `use-create-transaction/index.ts` (versi asli,
 * `useEntityForm`):
 * - TIDAK lagi terima `open`/`defaultAccountId` — `defaultValues` dan
 *   reset-on-open sekarang tanggung jawab `BaseForm` di level pemanggil,
 *   bukan hook ini.
 * - TIDAK lagi punya `keepOpen` di `onSuccess` — parameter itu sisa API
 *   tombol "Simpan & Lanjut" yang sudah dihapus, `useDbMutation.onSuccess`
 *   cuma terima `(result)`, jadi `onClosed` SELALU dipanggil setelah
 *   sukses (tidak ada mode "keep open" lagi).
 * - `onSuccess` dipisah ke `handle-create-success.ts`
 *   (`handleCreateTransactionSuccess`), terima `options` apa adanya —
 *   pola sama `createTransaction` yang juga dipisah dari hook React-nya.
 */

import { useDbMutation } from "@/hooks/use-db-mutation";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import type { UseCreateTransactionBaseFormOptions } from "./type-base-form";
import { createTransaction } from "../../../hooks/use-create-transaction/create-transaction";
import { handleCreateTransactionSuccess } from "./handle-create-success";

export function useCreateTransactionBaseForm(options: UseCreateTransactionBaseFormOptions = {}) {
  const mutation = useDbMutation({
    mutationFn: createTransaction,
    invalidateKey: QUERY_DEPENDENCIES.transactions,
    successMessage: "Transaksi berhasil ditambahkan",
    errorMessage: "Gagal menambahkan transaksi",
    onSuccess: (transactionId) => handleCreateTransactionSuccess(transactionId, options),
  });

  return {
    onSubmit: mutation.mutate,
    isPending: mutation.isPending,
  };
}
